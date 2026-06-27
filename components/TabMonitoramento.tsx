'use client';

import { useState, useCallback } from 'react';
import {
  calcularAcuracidade,
  formatarMoeda,
  getBadgeClass,
  truncarTexto,
} from '@/lib/auxiliaresUI';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';
import { padronizarNomeCidade } from '@/lib/filtros';

interface TabMonitoramentoProps {
  materiais: Material[];
  contagens: ContagensMap;
}

// Material agrupado por descrição + cidade + UF para a visão analítica.
type MaterialAgrupado = Material & {
  cidade: string;
  uf: string;
  valorEstoque: number;
  idsVinculados: number[];
};

export default function TabMonitoramento({ materiais, contagens }: TabMonitoramentoProps) {
  const materiaisComFisico = materiais.map((m) => {
    const physical = m.id in contagens ? contagens[m.id].novaQtd : 0;
    const desvio = physical - m.saldoAtual;
    const preco = m.precoUnitario || 0;
    const impacto = desvio * preco;
    return { ...m, physical, desvio, impacto };
  });

  const totalItens = materiais.length;
  const valorTotalEstoque = materiais.reduce((acc, m) => acc + m.saldoAtual * (m.precoUnitario || 0), 0);

  const statsAcuracidade = calcularAcuracidade(materiais, contagens);
  const taxaAcuracidade = statsAcuracidade.taxaAcuracidade;
  const totalContados = statsAcuracidade.contados;

  const resultadoLiquido = materiaisComFisico.reduce((acc, m) => acc + m.impacto, 0);

  // Divergências positivas (saldo físico > sistêmico) e negativas (saldo físico < sistêmico)
  const positivos = materiaisComFisico.filter((m) => m.id in contagens && m.desvio > 0);
  const negativos = materiaisComFisico.filter((m) => m.id in contagens && m.desvio < 0);
  const valorPositivos = positivos.reduce((acc, m) => acc + m.impacto, 0);
  const valorNegativos = negativos.reduce((acc, m) => acc + m.impacto, 0);


  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (taxaAcuracidade / 100) * circumference;

  const [filtroSinal, setFiltroSinal] = useState<'todos' | 'negativos' | 'positivos'>('todos');
  const [filtroTipoContrato, setFiltroTipoContrato] = useState<'todos' | 'ferramenta' | 'sso'>('todos');

  const obterUF = (origem: string): string => {
    const origemUpper = (origem || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (origemUpper === 'ESPIRITO SANTO') return 'ES';
    if (origemUpper === 'SAO PAULO') return 'SP';
    if (origemUpper === 'CURITIBA') return 'PR';
    if (['UBERLANDIA', 'VALADARES', 'BELO HORIZONTE', 'JUIZ DE FORA', 'VARGINHA'].includes(origemUpper)) return 'MG';
    if (origemUpper === 'CAMPO GRANDE') return 'MS';
    return 'RJ';
  };

  const materiaisAgrupadosPorNome = Array.from(
    materiais.reduce((map, m) => {
      const city = padronizarNomeCidade(m.grupo || '') || 'OUTRAS';
      const uf = obterUF(m.origem);
      const key = `${m.descricao}||${city}||${uf}||${m.contrato || ''}||${m.grupo || ''}`;
      if (!map.has(key)) {
        map.set(key, { ...m, cidade: city, uf, contrato: m.contrato, grupo: m.grupo, saldoAtual: 0, valorEstoque: 0, idsVinculados: [] });
      }
      const agrupado = map.get(key)!;
      agrupado.saldoAtual += m.saldoAtual;
      agrupado.valorEstoque += m.saldoAtual * (m.precoUnitario || 0);
      agrupado.idsVinculados.push(m.id);
      return map;
    }, new Map<string, MaterialAgrupado>())
  ).map(([, val]) => val);

  const materiaisAnalitico = materiaisAgrupadosPorNome
    .sort((a, b) => b.valorEstoque - a.valorEstoque);

  const getImpactoColor = useCallback((v: number) => {
    if (v < 0) return 'var(--danger)';
    if (v > 0) return 'var(--success)';
    return 'var(--text-main)';
  }, []);

  const materiaisProcessados = materiaisAnalitico.map((item) => {
    const fisico = item.idsVinculados.reduce((acc: number, id: number) => {
      const val = contagens[id]?.novaQtd;
      return acc + (val !== undefined ? val : 0);
    }, 0);
    
    const totalFisico = fisico * (item.precoUnitario || 0);
    const totalFinal = totalFisico - item.valorEstoque;
    
    return {
      ...item,
      fisico,
      totalFisico,
      totalFinal
    };
  });

  const materiaisFiltrados = materiaisProcessados.filter((item) => {
    if (filtroSinal === 'negativos' && item.totalFinal >= 0) return false;
    if (filtroSinal === 'positivos' && item.totalFinal <= 0) return false;

    const cNum = item.contrato || 0;
    const isFerramenta = [1, 21, 58, 61, 71].includes(cNum);
    if (filtroTipoContrato === 'ferramenta' && !isFerramenta) return false;
    if (filtroTipoContrato === 'sso' && isFerramenta) return false;

    return true;
  });

  const exportarAnalitico = useCallback(() => {
    if (typeof window === 'undefined') return;
    const XLSX = (window as unknown as { XLSX?: typeof import('xlsx') }).XLSX;
    if (!XLSX) {
      alert('Biblioteca XLSX não carregada.');
      return;
    }

    const dados = materiaisFiltrados.map((item, i) => {
      const acuraciaValor = (item.precoUnitario || 0) * Math.min(item.saldoAtual || 0, item.fisico || 0);
      return {
        '#': i + 1,
        'UF': item.uf || '—',
        'Cidade': item.cidade || '—',
        'Contrato': item.contrato || '—',
        'Projeto': item.grupo || '—',
        'Classe': item.classeABC ? `Classe ${item.classeABC}` : '—',
        'Descrição': item.descricao,
        'Saldo Sistêmico': item.saldoAtual,
        'Saldo Físico': item.fisico,
        'Preço Unitário': item.precoUnitario,
        'Total Sistêmico (R$)': item.valorEstoque,
        'Total Físico (R$)': item.totalFisico,
        'Acurácia (R$)': acuraciaValor,
        'Diferença Final (R$)': item.totalFinal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabela Analítica');
    XLSX.writeFile(wb, `SGI_Tabela_Analitica_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  }, [materiaisFiltrados]);

  return (
    <div>
      <div className="stats-container animate-fade-in" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem' }}>
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Patrimônio Total</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarMoeda(valorTotalEstoque)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Valoração total sob gestão</span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            <i className="fas fa-boxes"></i>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Volume de Itens</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap' }}>
              {totalItens} / {materiais.filter((m) => m.id in contagens).length}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Itens totais / auditados</span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(107, 114, 128, 0.08)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            <i className="fas fa-barcode"></i>
          </div>
        </div>

        {/* KPI: Negativos Totais */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Negativos Totais</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--danger)', fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarMoeda(valorNegativos)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Falta total em estoque</span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            <i className="fas fa-arrow-trend-down"></i>
          </div>
        </div>

        {/* KPI: Positivos Totais */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid rgba(22, 163, 74, 0.25)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Positivos Totais</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)', fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarMoeda(valorPositivos)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Sobra total em estoque</span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            <i className="fas fa-arrow-trend-up"></i>
          </div>
        </div>

        {/* KPI: Impacto Líquido */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Impacto Líquido</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: getImpactoColor(resultadoLiquido), fontFamily: 'Quicksand, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatarMoeda(resultadoLiquido)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Saldo das divergências</span>
          </div>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: resultadoLiquido < 0 ? 'rgba(239, 68, 68, 0.08)' : resultadoLiquido > 0 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(107, 114, 128, 0.08)', color: resultadoLiquido < 0 ? 'var(--danger)' : resultadoLiquido > 0 ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, marginLeft: '0.5rem' }}>
            <i className="fas fa-coins"></i>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid animate-fade-in" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
        {/* Gauge Acuracidade */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-bullseye"></i> Acuracidade das Auditorias</div>
          <div className="chart-container">
            <svg className="svg-chart" width="160" height="160" viewBox="0 0 100 100">
              <circle className="svg-gauge-bg" cx="50" cy="50" r="40" strokeWidth="8" />
              <circle
                className="svg-gauge-fill" cx="50" cy="50" r="40" strokeWidth="8"
                strokeDasharray={circumference} strokeDashoffset={dashoffset}
                transform="rotate(-90 50 50)"
              />
              <text className="svg-gauge-text" x="50" y="52" fontSize="14" textAnchor="middle">{taxaAcuracidade}%</text>
              <text className="svg-gauge-label" x="50" y="65" textAnchor="middle">ACURÁCIA</text>
            </svg>
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Com base em <strong>{totalContados}</strong> itens auditados.
          </div>
        </div>

        {/* Gráfico de Acuracidade por Cidade */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-chart-column"></i> Acuracidade por Cidade</div>
          {(() => {
            const items = Object.entries(
              materiais.reduce((acc, m) => {
                const city = padronizarNomeCidade(m.grupo || '') || 'OUTRAS';
                if (!acc[city]) acc[city] = [];
                acc[city].push(m);
                return acc;
              }, {} as Record<string, Material[]>)
            )
            .map(([cidade, mats]) => {
              const res = calcularAcuracidade(mats, contagens);
              return { cidade, taxa: res.taxaAcuracidade, contados: res.contados };
            })
            .filter((item) => item.contados > 0)
            .sort((a, b) => b.contados - a.contados || b.taxa - a.taxa || a.cidade.localeCompare(b.cidade));

            if (items.length === 0) {
              return (
                <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                    Nenhuma cidade com auditoria iniciada sob os filtros atuais.
                  </div>
                </div>
              );
            }

            const justifyValue = items.length <= 6 ? 'space-around' : 'flex-start';

            return (
              <div className="chart-container" style={{ 
                display: 'flex', 
                alignItems: 'flex-end', 
                justifyContent: justifyValue, 
                height: '100%', 
                padding: '1rem', 
                gap: '0.75rem', 
                overflowX: 'auto', 
                overflowY: 'hidden' 
              }}>
                {items.map((item) => (
                  <div key={item.cidade} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    flex: items.length <= 6 ? '1' : '0 0 65px', 
                    width: items.length <= 6 ? 'auto' : '65px', 
                    gap: '0.25rem', 
                    height: '100%', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 'auto' }}>
                      {item.taxa}%
                    </div>
                    <div style={{ width: '22px', height: '120px', display: 'flex', alignItems: 'flex-end', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: '100%', 
                        height: `${item.taxa}%`, 
                        background: item.taxa === 100 ? 'var(--success)' : item.taxa >= 80 ? 'var(--warning)' : 'var(--danger)',
                        transition: 'height 0.8s ease',
                        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
                      }} />
                    </div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', lineHeight: '1.1', color: 'var(--text-muted)' }}>
                      {item.cidade}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      {/* Tabela Analítica */}
      <div className="card animate-fade-in" style={{ marginTop: '2rem', background: 'var(--bg-card)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
        <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-list"></i> Tabela Analítica de Materiais
          </span>

          {/* Filtros no Header da Tabela */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginLeft: 'auto', marginRight: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Divergência:</span>
              <select 
                value={filtroSinal}
                onChange={(e) => setFiltroSinal(e.target.value as any)}
                style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', outline: 'none' }}
              >
                <option value="todos">Todas</option>
                <option value="negativos">Negativas (Faltas)</option>
                <option value="positivos">Positivas (Sobras)</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Contrato:</span>
              <select 
                value={filtroTipoContrato}
                onChange={(e) => setFiltroTipoContrato(e.target.value as any)}
                style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-body)', color: 'var(--text-main)', outline: 'none' }}
              >
                <option value="todos">Todos</option>
                <option value="ferramenta">Ferramental</option>
                <option value="sso">SSO</option>
              </select>
            </div>

            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, borderLeft: '1px solid var(--border-color)', paddingLeft: '0.75rem' }}>
              {materiaisFiltrados.length} / {materiaisAnalitico.length} itens
            </span>
          </div>

          <button className="btn-excel-mini" onClick={exportarAnalitico}>
            <i className="fas fa-file-excel"></i> Exportar Analítico
          </button>
        </h3>
        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto', background: 'var(--bg-card)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
          <style dangerouslySetInnerHTML={{__html: `
            .compact-monitor-table th, 
            .compact-monitor-table td {
              padding: 6px 8px !important;
              font-size: 0.65rem !important;
            }
            .compact-monitor-table th {
              font-weight: 700 !important;
              text-transform: uppercase;
              letter-spacing: 0.02em;
            }
          `}} />
          <table className="compact-monitor-table" style={{ width: '100%', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>#</th>
                <th>UF</th>
                <th>Cidade</th>
                <th>Contrato</th>
                <th>Projeto</th>
                <th>Classe</th>
                <th>Descrição</th>
                <th>Saldo Sist.</th>
                <th>Saldo Fís.</th>
                <th>Preço Unit.</th>
                <th>Total Sist.</th>
                <th>Total Fís.</th>
                <th>Acurácia (R$)</th>
                <th>Total Final</th>
              </tr>
            </thead>
            <tbody>
              {materiaisFiltrados.map((item, i) => {
                const acuraciaValor = (item.precoUnitario || 0) * Math.min(item.saldoAtual || 0, item.fisico || 0);
                return (
                  <tr key={`${item.descricao}||${item.cidade}||${item.uf}||${item.contrato || ''}||${item.grupo || ''}`}>
                    <td><span className="badge" style={{ background: 'var(--text-main)', color: 'var(--bg-body)', padding: '2px 5px', fontSize: '0.6rem' }}>#{i + 1}</span></td>
                    <td><span className="badge" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, padding: '2px 5px', fontSize: '0.6rem' }}>{item.uf}</span></td>
                    <td title={item.cidade} style={{ textTransform: 'uppercase', fontWeight: 600 }}>{truncarTexto(item.cidade, 12)}</td>
                    <td style={{ fontWeight: 600 }}>{item.contrato || '—'}</td>
                    <td title={item.grupo} style={{ fontWeight: 600 }}>{truncarTexto(item.grupo || '—', 18)}</td>
                    <td>
                      {item.classeABC ? (
                        <span className="badge" style={{ 
                          background: item.classeABC === 'A' ? 'var(--text-main)' : item.classeABC === 'B' ? 'var(--text-muted)' : 'var(--border-color)',
                          color: item.classeABC === 'A' ? 'var(--bg-body)' : '#fff',
                          padding: '2px 5px',
                          fontSize: '0.6rem'
                        }}>
                          Classe {item.classeABC}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td title={item.descricao} style={{ fontWeight: 600 }}>{truncarTexto(item.descricao, 32)}</td>
                    <td><span className={`badge ${getBadgeClass(item.saldoAtual)}`}>{item.saldoAtual}</span></td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>{item.fisico}</span>
                    </td>
                    <td>{formatarMoeda(item.precoUnitario)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(item.valorEstoque)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(item.totalFisico)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(acuraciaValor)}</td>
                    <td style={{ fontWeight: 600, color: getImpactoColor(item.totalFinal) }}>
                      {formatarMoeda(item.totalFinal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2, boxShadow: '0 -2px 5px rgba(0,0,0,0.05)' }}>
              <tr style={{ background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={10} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL GERAL</td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisFiltrados.reduce((acc, item) => acc + item.valorEstoque, 0))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisFiltrados.reduce((acc, item) => acc + item.totalFisico, 0))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisFiltrados.reduce((acc, item) => acc + ((item.precoUnitario || 0) * Math.min(item.saldoAtual || 0, item.fisico || 0)), 0))}
                </td>
                <td style={{ fontWeight: 800, color: getImpactoColor(materiaisFiltrados.reduce((acc, item) => acc + item.totalFinal, 0)) }}>
                  {formatarMoeda(materiaisFiltrados.reduce((acc, item) => acc + item.totalFinal, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


    </div>
  );
}
