'use client';

import { useCallback, useState } from 'react';
import {
  calcularAcuracidade,
  calcularFinanceiroDivergencias,
  classificarCurvaABC,
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

export default function TabMonitoramento({ materiais, contagens }: TabMonitoramentoProps) {
  const [divergenciasAbertas, setDivergenciasAbertas] = useState(false);

  const materiaisComFisico = materiais.map((m) => {
    const physical = m.id in contagens ? contagens[m.id].novaQtd : 0;
    const desvio = physical - m.saldoAtual;
    const preco = m.precoUnitario || 0;
    const impacto = desvio * preco;
    return { ...m, physical, desvio, impacto };
  });

  const totalItens = materiais.length;
  const valorTotalEstoque = materiais.reduce((acc, m) => acc + m.saldoAtual * (m.precoUnitario || 0), 0);

  const totalDivergentes = materiaisComFisico.filter((m) => m.desvio !== 0).length;
  const acertos = materiaisComFisico.filter((m) => m.desvio === 0).length;
  const taxaAcuracidade = totalItens > 0 ? Math.round((acertos / totalItens) * 100) : 100;
  const totalContados = totalItens;

  const resultadoLiquido = materiaisComFisico.reduce((acc, m) => acc + m.impacto, 0);





  const totalDisponivel = materiais.filter((m) => m.saldoAtual > 0).length;
  const totalZerado = materiais.filter((m) => m.saldoAtual === 0).length;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference - (taxaAcuracidade / 100) * circumference;

  const obterUF = (origem: string): string => {
    const origemUpper = (origem || '').toUpperCase();
    if (origemUpper === 'ESPIRITO SANTO' || origemUpper === 'ESPÍRITO SANTO') return 'ES';
    if (origemUpper === 'SÃO PAULO' || origemUpper === 'SAO PAULO') return 'SP';
    if (origemUpper === 'CURITIBA') return 'PR';
    if (origemUpper === 'MINAS GERAIS') return 'MG';
    return 'RJ';
  };

  const materiaisAgrupadosPorNome = Array.from(
    materiais.reduce((map, m) => {
      const city = padronizarNomeCidade(m.grupo || '') || 'OUTRAS';
      const uf = obterUF(m.origem);
      const key = `${m.descricao}||${city}||${uf}`;
      if (!map.has(key)) {
        map.set(key, { ...m, cidade: city, uf, saldoAtual: 0, valorEstoque: 0, idsVinculados: [] });
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


  const pctDisponivel = totalItens > 0 ? Math.round((totalDisponivel / totalItens) * 100) : 0;
  const pctZerado = totalItens > 0 ? Math.round((totalZerado / totalItens) * 100) : 0;

  const getImpactoColor = useCallback((v: number) => {
    if (v < 0) return 'var(--danger)';
    if (v > 0) return 'var(--success)';
    return 'var(--text-main)';
  }, []);

  const exportarAnalitico = useCallback(() => {
    if (typeof window === 'undefined') return;
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert('Biblioteca XLSX não carregada.');
      return;
    }

    const dados = materiaisAnalitico.map((item, i) => {
      const fisico = item.idsVinculados.reduce((acc: number, id: number) => {
        const val = contagens[id]?.novaQtd;
        return acc + (val !== undefined ? val : 0);
      }, 0);
      
      const totalFisico = fisico * (item.precoUnitario || 0);
      const totalFinal = totalFisico - item.valorEstoque;

      return {
        '#': i + 1,
        'UF': item.uf || '—',
        'Cidade': item.cidade || '—',
        'Classe': item.classeABC ? `Classe ${item.classeABC}` : '—',
        'Descrição': item.descricao,
        'Saldo Sistêmico': item.saldoAtual,
        'Saldo Físico': fisico,
        'Preço Unitário': item.precoUnitario,
        'Total Sistêmico (R$)': item.valorEstoque,
        'Total Físico (R$)': totalFisico,
        'Diferença Final (R$)': totalFinal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabela Analítica');
    XLSX.writeFile(wb, `SGI_Tabela_Analitica_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  }, [materiaisAnalitico, contagens]);

  return (
    <div>
      <div className="stats-container animate-fade-in">
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Patrimônio Total</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{formatarMoeda(valorTotalEstoque)}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Valoração total sob gestão</span>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
            <i className="fas fa-boxes"></i>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Volume de Itens</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>
              {totalItens} / {materiais.filter((m) => m.id in contagens).length}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Volume de itens / itens auditados</span>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(107, 114, 128, 0.08)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
            <i className="fas fa-barcode"></i>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Divergências</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: totalDivergentes > 0 ? 'var(--warning)' : 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{totalDivergentes}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contagens divergentes</span>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: totalDivergentes > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(107, 114, 128, 0.08)', color: totalDivergentes > 0 ? '#d97706' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
            <i className="fas fa-exclamation-triangle"></i>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Impacto Líquido</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: getImpactoColor(resultadoLiquido), fontFamily: 'Quicksand, sans-serif' }}>{formatarMoeda(resultadoLiquido)}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Saldo das divergências</span>
          </div>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: resultadoLiquido < 0 ? 'rgba(239, 68, 68, 0.08)' : resultadoLiquido > 0 ? 'rgba(22, 163, 74, 0.08)' : 'rgba(107, 114, 128, 0.08)', color: resultadoLiquido < 0 ? 'var(--danger)' : resultadoLiquido > 0 ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
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
              const acertosCidade = mats.filter((m) => {
                const physical = m.id in contagens ? contagens[m.id].novaQtd : 0;
                return physical === m.saldoAtual;
              }).length;
              const taxa = mats.length > 0 ? Math.round((acertosCidade / mats.length) * 100) : 100;
              return { cidade, taxa, contados: mats.length };
            })
            .sort((a, b) => b.contados - a.contados || b.taxa - a.taxa || a.cidade.localeCompare(b.cidade));

            if (items.length === 0) {
              return (
                <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>
                    Nenhuma cidade disponível sob os filtros atuais.
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
        <h3 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span>
            <i className="fas fa-list"></i> Tabela Analítica de Materiais
          </span>
          <button className="btn btn-secondary btn-excel" onClick={exportarAnalitico} style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
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
                <th>#</th><th>UF</th><th>Cidade</th><th>Classe</th><th>Descrição</th><th>Saldo Sist.</th><th>Saldo Fís.</th><th>Preço Unit.</th><th>Total Sist.</th><th>Total Fís.</th><th>Total Final</th>
              </tr>
            </thead>
            <tbody>
              {materiaisAnalitico.map((item, i) => {
                const fisico = item.idsVinculados.reduce((acc: number, id: number) => {
                  const val = contagens[id]?.novaQtd;
                  return acc + (val !== undefined ? val : 0);
                }, 0);
                
                const totalFisico = fisico * (item.precoUnitario || 0);
                const totalFinal = totalFisico - item.valorEstoque;

                return (
                  <tr key={`${item.descricao}||${item.cidade}||${item.uf}`}>
                    <td><span className="badge" style={{ background: 'var(--text-main)', color: 'var(--bg-body)', padding: '2px 5px', fontSize: '0.6rem' }}>#{i + 1}</span></td>
                    <td><span className="badge" style={{ background: 'var(--primary)', color: '#fff', fontWeight: 700, padding: '2px 5px', fontSize: '0.6rem' }}>{item.uf}</span></td>
                    <td title={item.cidade} style={{ textTransform: 'uppercase', fontWeight: 600 }}>{truncarTexto(item.cidade, 12)}</td>
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
                      <span className="badge" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>{fisico}</span>
                    </td>
                    <td>{formatarMoeda(item.precoUnitario)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(item.valorEstoque)}</td>
                    <td style={{ fontWeight: 600 }}>{formatarMoeda(totalFisico)}</td>
                    <td style={{ fontWeight: 600, color: getImpactoColor(totalFinal) }}>
                      {formatarMoeda(totalFinal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 2, boxShadow: '0 -2px 5px rgba(0,0,0,0.05)' }}>
              <tr style={{ background: 'var(--bg-card)', borderTop: '2px solid var(--border-color)' }}>
                <td colSpan={8} style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL GERAL</td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => acc + item.valorEstoque, 0))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => {
                    const f = item.idsVinculados.reduce((sum: number, id: number) => {
                      const val = contagens[id]?.novaQtd;
                      return sum + (val !== undefined ? val : 0);
                    }, 0);
                    return acc + (f * (item.precoUnitario || 0));
                  }, 0))}
                </td>
                <td style={{ fontWeight: 800, color: getImpactoColor(materiaisAnalitico.reduce((acc, item) => {
                  const f = item.idsVinculados.reduce((sum: number, id: number) => {
                    const val = contagens[id]?.novaQtd;
                    return sum + (val !== undefined ? val : 0);
                  }, 0);
                  const tFisico = f * (item.precoUnitario || 0);
                  return acc + (tFisico - item.valorEstoque);
                }, 0)) }}>
                  {formatarMoeda(materiaisAnalitico.reduce((acc, item) => {
                    const f = item.idsVinculados.reduce((sum: number, id: number) => {
                      const val = contagens[id]?.novaQtd;
                      return sum + (val !== undefined ? val : 0);
                    }, 0);
                    const tFisico = f * (item.precoUnitario || 0);
                    return acc + (tFisico - item.valorEstoque);
                  }, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>


    </div>
  );
}
