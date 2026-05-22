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

  const abc = classificarCurvaABC(materiais, contagens);
  const valorA = abc.classes.A.reduce((s, i) => s + i.valorEstoque, 0);
  const valorB = abc.classes.B.reduce((s, i) => s + i.valorEstoque, 0);
  const valorC = abc.classes.C.reduce((s, i) => s + i.valorEstoque, 0);

  const totalDisponivel = materiais.filter((m) => m.saldoAtual > 0).length;
  const totalZerado = materiais.filter((m) => m.saldoAtual === 0).length;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (taxaAcuracidade / 100) * circumference;

  const itensComValor = materiais
    .map((m) => ({ ...m, valorEstoque: m.saldoAtual * (m.precoUnitario || 0) }))
    .sort((a, b) => b.valorEstoque - a.valorEstoque);
  const top5 = itensComValor.slice(0, 5);

  const divergenciasAtivas = materiais.flatMap((m) => {
    if (!(m.id in contagens)) return [];
    const novaQtd = contagens[m.id].novaQtd;
    if (novaQtd === m.saldoAtual) return [];
    const desvio = novaQtd - m.saldoAtual;
    return [{ descricao: m.descricao, saldoAtual: m.saldoAtual, novaQtd, desvio, impacto: desvio * (m.precoUnitario || 0) }];
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

        {/* Barras ABC */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-chart-pie"></i> Valor Estocado por Classe</div>
          <div className="chart-container" style={{ flexDirection: 'column', justifyContent: 'space-around', gap: '0.75rem', padding: '1rem 0' }}>
            {[
              { label: 'Classe A (Alta Relevância)', valor: valorA, pct: pctBarA, cls: 'svg-bar-fill-A' },
              { label: 'Classe B (Média Relevância)', valor: valorB, pct: pctBarB, cls: 'svg-bar-fill-B' },
              { label: 'Classe C (Baixa Relevância)', valor: valorC, pct: pctBarC, cls: 'svg-bar-fill-C' },
            ].map((item) => (
              <div key={item.cls} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span>{item.label}</span><span>{formatarMoeda(item.valor)}</span>
                </div>
                <div className="progress-track" style={{ height: '10px' }}>
                  <div className={item.cls} style={{ width: `${item.pct}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disponibilidade */}
        <div className="chart-card">
          <div className="chart-card-title"><i className="fas fa-boxes-packing"></i> Nível de Disponibilidade</div>
          <div className="chart-container" style={{ flexDirection: 'column', justifyContent: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
              <i className="fas fa-box" style={{ fontSize: '1.5rem', color: 'var(--text-main)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span>Disponível</span><span>{pctDisponivel}% ({totalDisponivel})</span>
                </div>
                <div className="progress-track" style={{ height: '8px', marginTop: '0.25rem' }}>
                  <div className="progress-fill" style={{ width: `${pctDisponivel}%` }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
              <i className="fas fa-box-open" style={{ fontSize: '1.5rem', color: 'var(--danger)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600 }}>
                  <span>Zerado</span><span>{pctZerado}% ({totalZerado})</span>
                </div>
                <div className="progress-track" style={{ height: '8px', marginTop: '0.25rem' }}>
                  <div style={{ width: `${pctZerado}%`, height: '100%', borderRadius: '4px', background: 'var(--danger)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 */}
      <div className="card animate-fade-in" style={{ marginTop: '2rem' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '1.15rem', marginBottom: '1rem' }}>
          <i className="fas fa-trophy"></i> Top 5 Materiais por Valor Patrimonial
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Descrição</th><th>Saldo</th><th>Preço Unit.</th><th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((item, i) => (
                <tr key={item.id}>
                  <td><span className="badge" style={{ background: 'var(--text-main)', color: 'var(--bg-body)' }}>#{i + 1}</span></td>
                  <td><strong>{item.descricao}</strong></td>
                  <td><span className={`badge ${getBadgeClass(item.saldoAtual)}`}>{item.saldoAtual}</span></td>
                  <td>{formatarMoeda(item.precoUnitario)}</td>
                  <td style={{ fontWeight: 600 }}>{formatarMoeda(item.valorEstoque)}</td>
                </tr>
              ))}
            </tbody>
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
            <table>
              <thead>
                <tr><th>Material</th><th>Saldo Sistema</th><th>Contagem Física</th><th>Desvio</th><th>Impacto</th></tr>
              </thead>
              <tbody>
                {divergenciasAtivas.map((d, i) => (
                  <tr key={i}>
                    <td>{d.descricao}</td>
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
