'use client';

import { useCallback } from 'react';
import {
  calcularAcuracidade,
  calcularFinanceiroDivergencias,
  classificarCurvaABC,
  formatarMoeda,
  getBadgeClass,
} from '@/lib/auxiliaresUI';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';

interface TabMonitoramentoProps {
  materiais: Material[];
  contagens: ContagensMap;
}

export default function TabMonitoramento({ materiais, contagens }: TabMonitoramentoProps) {
  const totalItens = materiais.length;
  const valorTotalEstoque = materiais.reduce((acc, m) => acc + m.saldoAtual * (m.precoUnitario || 0), 0);

  const acuracidadeStats = calcularAcuracidade(materiais, contagens);
  const { divergentes: totalDivergentes, taxaAcuracidade, contados: totalContados } = acuracidadeStats;

  const financeiro = calcularFinanceiroDivergencias(materiais, contagens);
  const { resultadoLiquido } = financeiro;

  const valorTotalFisico = materiais.reduce((acc, m) => {
    const f = contagens[m.id]?.novaQtd;
    return acc + (f !== undefined ? f * (m.precoUnitario || 0) : 0);
  }, 0);
  const maxValorFinanceiro = Math.max(valorTotalEstoque, valorTotalFisico, 1);
  const pctSistemico = Math.round((valorTotalEstoque / maxValorFinanceiro) * 100);
  const pctFisico = Math.round((valorTotalFisico / maxValorFinanceiro) * 100);
  const pctFinal = Math.min(100, Math.round((Math.abs(resultadoLiquido) / maxValorFinanceiro) * 100));

  const abc = classificarCurvaABC(materiais, contagens);
  const valorA = abc.classes.A.reduce((s, i) => s + i.valorEstoque, 0);
  const valorB = abc.classes.B.reduce((s, i) => s + i.valorEstoque, 0);
  const valorC = abc.classes.C.reduce((s, i) => s + i.valorEstoque, 0);

  const totalDisponivel = materiais.filter((m) => m.saldoAtual > 0).length;
  const totalZerado = materiais.filter((m) => m.saldoAtual === 0).length;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (taxaAcuracidade / 100) * circumference;

  const materiaisAgrupadosPorNome = Array.from(
    materiais.reduce((map, m) => {
      const key = m.descricao;
      if (!map.has(key)) {
        map.set(key, { ...m, saldoAtual: 0, valorEstoque: 0, idsVinculados: [] });
      }
      const agrupado = map.get(key)!;
      agrupado.saldoAtual += m.saldoAtual;
      agrupado.valorEstoque += m.saldoAtual * (m.precoUnitario || 0);
      agrupado.idsVinculados.push(m.id);
      return map;
    }, new Map<string, any>())
  ).map(([, val]) => val);

  const materiaisAnalitico = materiaisAgrupadosPorNome
    .sort((a, b) => b.valorEstoque - a.valorEstoque);

  const divergenciasAtivas = materiais.flatMap((m) => {
    if (!(m.id in contagens)) return [];
    const novaQtd = contagens[m.id].novaQtd;
    if (novaQtd === m.saldoAtual) return [];
    const desvio = novaQtd - m.saldoAtual;
    return [{ descricao: m.descricao, origem: m.origem, saldoAtual: m.saldoAtual, novaQtd, desvio, impacto: desvio * (m.precoUnitario || 0) }];
  });

  const maxValor = Math.max(valorA, valorB, valorC, 1);
  const pctBarA = Math.round((valorA / maxValor) * 100);
  const pctBarB = Math.round((valorB / maxValor) * 100);
  const pctBarC = Math.round((valorC / maxValor) * 100);
  const pctDisponivel = totalItens > 0 ? Math.round((totalDisponivel / totalItens) * 100) : 0;
  const pctZerado = totalItens > 0 ? Math.round((totalZerado / totalItens) * 100) : 0;

  const getImpactoColor = useCallback((v: number) => {
    if (v < 0) return 'var(--danger)';
    if (v > 0) return 'var(--success)';
    return 'var(--text-main)';
  }, []);

  return (
    <div>
      {/* KPIs */}
      <div className="stats-container animate-fade-in">
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-boxes"></i> Patrimônio Total</div>
          <div className="stat-number">{formatarMoeda(valorTotalEstoque)}</div>
          <div className="stat-desc">Valoração total sob gestão</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-barcode"></i> Volume de Itens</div>
          <div className="stat-number">{totalItens}</div>
          <div className="stat-desc">Materiais selecionados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-exclamation-triangle"></i> Diferenças</div>
          <div className="stat-number" style={{ color: totalDivergentes > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
            {totalDivergentes}
          </div>
          <div className="stat-desc">Contagens com divergência física</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-coins"></i> Impacto Líquido</div>
          <div className="stat-number" style={{ color: getImpactoColor(resultadoLiquido) }}>
            {formatarMoeda(resultadoLiquido)}
          </div>
          <div className="stat-desc">Saldo financeiro das divergências</div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid animate-fade-in">
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

        {/* Valores Totais */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-wallet"></i> Balanço Financeiro</div>
          <div className="chart-container" style={{ flexDirection: 'column', justifyContent: 'space-around', gap: '0.75rem', padding: '1rem 0' }}>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>Total Sistêmico</span><span>{formatarMoeda(valorTotalEstoque)}</span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div style={{ width: `${pctSistemico}%`, height: '100%', borderRadius: '4px', background: 'var(--text-main)' }} />
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>Total Físico</span><span>{formatarMoeda(valorTotalFisico)}</span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div style={{ width: `${pctFisico}%`, height: '100%', borderRadius: '4px', background: 'var(--success)' }} />
              </div>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                <span>Resultado Final (Diferença)</span><span style={{ color: getImpactoColor(resultadoLiquido) }}>{formatarMoeda(resultadoLiquido)}</span>
              </div>
              <div className="progress-track" style={{ height: '10px' }}>
                <div style={{ width: `${pctFinal}%`, height: '100%', borderRadius: '4px', background: getImpactoColor(resultadoLiquido) }} />
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de Acuracidade por UF */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-chart-column"></i> Acuracidade por UF</div>
          <div className="chart-container" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '100%', padding: '1rem', gap: '0.25rem', overflow: 'hidden' }}>
            {Object.entries(
              materiais.reduce((acc, m) => {
                const cidadeUpper = (m.origem || '').toUpperCase();
                let uf = 'Outros';
                if (cidadeUpper === 'ESPIRITO SANTO' || cidadeUpper === 'ES') uf = 'Espírito Santo';
                else if (cidadeUpper === 'SÃO PAULO' || cidadeUpper === 'SAO PAULO' || cidadeUpper === 'SP') uf = 'São Paulo';
                else if (cidadeUpper === 'CURITIBA' || cidadeUpper === 'PARANA' || cidadeUpper === 'PARANÁ' || cidadeUpper === 'PR') uf = 'Paraná';
                else if (cidadeUpper === 'MINAS GERAIS' || cidadeUpper === 'MG') uf = 'Minas Gerais';
                else if ((cidadeUpper.includes('RIO') && cidadeUpper.includes('JANEIRO')) || cidadeUpper === 'RJ') uf = 'Rio de Janeiro';

                if (!acc[uf]) acc[uf] = [];
                acc[uf].push(m);
                return acc;
              }, {} as Record<string, Material[]>)
            )
            .filter(([uf]) => uf !== 'Outros') // Garante que só os 5 estados oficiais apareçam
            .map(([uf, mats]) => {
              const stats = calcularAcuracidade(mats, contagens);
              return { uf, taxa: stats.taxaAcuracidade, contados: stats.contados };
            }).sort((a, b) => b.taxa - a.taxa || a.uf.localeCompare(b.uf)).map((item) => (
              <div key={item.uf} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.25rem', height: '100%', overflow: 'hidden' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 'auto' }}>
                  {item.taxa}%
                </div>
                <div style={{ width: '20px', height: '120px', display: 'flex', alignItems: 'flex-end', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: '100%', 
                    height: `${item.taxa}%`, 
                    background: item.taxa === 100 ? 'var(--success)' : item.taxa >= 80 ? 'var(--warning)' : 'var(--danger)',
                    transition: 'height 0.8s ease',
                    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.1)'
                  }} />
                </div>
                <div style={{ fontSize: '0.55rem', fontWeight: 600, textAlign: 'center', textTransform: 'uppercase', minHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', wordBreak: 'break-word', lineHeight: '1.1' }}>
                  {item.uf}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela Analítica */}
      <div className="card animate-fade-in" style={{ marginTop: '2rem' }}>
        <h3 className="card-title" style={{ marginTop: '2rem' }}>
          <i className="fas fa-list"></i> Tabela Analítica de Materiais
        </h3>
        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              <tr>
                <th>#</th><th style={{ whiteSpace: 'normal', minWidth: '150px' }}>Descrição</th><th>Saldo Sist.</th><th>Saldo Fís.</th><th>Preço Unit.</th><th>Total Sist.</th><th>Total Fís.</th><th>Total Final</th>
              </tr>
            </thead>
            <tbody>
              {materiaisAnalitico.map((item, i) => {
                const fisico = item.idsVinculados.reduce((acc: number | undefined, id: number) => {
                  const val = contagens[id]?.novaQtd;
                  if (val !== undefined) return (acc || 0) + val;
                  return acc;
                }, undefined);
                
                const totalFisico = fisico !== undefined ? fisico * (item.precoUnitario || 0) : undefined;
                const totalFinal = totalFisico !== undefined ? totalFisico - item.valorEstoque : undefined;

                return (
                  <tr key={item.descricao}>
                    <td><span className="badge" style={{ background: 'var(--text-main)', color: 'var(--bg-body)' }}>#{i + 1}</span></td>
                    <td style={{ whiteSpace: 'normal', minWidth: '150px' }}><strong>{item.descricao}</strong></td>
                    <td><span className={`badge ${getBadgeClass(item.saldoAtual)}`}>{item.saldoAtual}</span></td>
                    <td>
                      {fisico !== undefined ? (
                        <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>{fisico}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>{formatarMoeda(item.precoUnitario)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(item.valorEstoque)}</td>
                    <td style={{ fontWeight: 600 }}>{totalFisico !== undefined ? formatarMoeda(totalFisico) : <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>—</span>}</td>
                    <td style={{ fontWeight: 600, color: totalFinal !== undefined ? getImpactoColor(totalFinal) : 'inherit' }}>
                      {totalFinal !== undefined ? formatarMoeda(totalFinal) : <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2, boxShadow: '0 -2px 5px rgba(0,0,0,0.05)' }}>
              <tr style={{ background: 'var(--glass-bg)', borderTop: '2px solid var(--glass-border)' }}>
                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL GERAL</td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => acc + item.valorEstoque, 0))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => {
                    const f = item.idsVinculados.reduce((sum: number | undefined, id: number) => {
                      const val = contagens[id]?.novaQtd;
                      if (val !== undefined) return (sum || 0) + val;
                      return sum;
                    }, undefined);
                    return acc + (f !== undefined ? f * (item.precoUnitario || 0) : 0);
                  }, 0))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => {
                    const f = item.idsVinculados.reduce((sum: number | undefined, id: number) => {
                      const val = contagens[id]?.novaQtd;
                      if (val !== undefined) return (sum || 0) + val;
                      return sum;
                    }, undefined);
                    const tFisico = f !== undefined ? f * (item.precoUnitario || 0) : 0;
                    return acc + (tFisico - item.valorEstoque);
                  }, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Divergências Ativas */}
      {divergenciasAtivas.length > 0 && (
        <div className="card animate-fade-in" style={{ marginTop: '2rem' }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--warning)' }}>
            <i className="fas fa-exclamation-triangle"></i> Divergências Ativas ({divergenciasAtivas.length})
          </h3>
          <div className="table-responsive">
            <table style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <thead>
                <tr><th>Material</th><th>Origem</th><th>Saldo Sistema</th><th>Contagem Física</th><th>Desvio</th><th>Impacto</th></tr>
              </thead>
              <tbody>
                {divergenciasAtivas.map((d, i) => (
                  <tr key={i}>
                    <td>{d.descricao}</td>
                    <td><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d.origem}</span></td>
                    <td>{d.saldoAtual}</td>
                    <td>{d.novaQtd}</td>
                    <td>
                      <span className={`badge-diff ${d.desvio > 0 ? 'sobra' : 'falta'}`}>
                        {d.desvio > 0 ? `+${d.desvio}` : d.desvio}
                      </span>
                    </td>
                    <td style={{ color: getImpactoColor(d.impacto), fontWeight: 600 }}>
                      {formatarMoeda(d.impacto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
