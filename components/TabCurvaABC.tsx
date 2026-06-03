'use client';

import {
  classificarCurvaABC,
  calcularAcuracidade,
  formatarMoeda,
  getBadgeClass,
} from '@/lib/auxiliaresUI';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';

interface TabCurvaABCProps {
  materiais: Material[];
  contagens: ContagensMap;
}

export default function TabCurvaABC({ materiais, contagens }: TabCurvaABCProps) {
  const abc = classificarCurvaABC(materiais, contagens);
  const totalItens = materiais.length;

  const totalA = abc.classes.A.length;
  const totalB = abc.classes.B.length;
  const totalC = abc.classes.C.length;

  const pctA = totalItens > 0 ? Math.round((totalA / totalItens) * 100) : 0;
  const pctB = totalItens > 0 ? Math.round((totalB / totalItens) * 100) : 0;
  const pctC = totalItens > 0 ? Math.round((totalC / totalItens) * 100) : 0;

  const valorA = abc.classes.A.reduce((s, i) => s + i.valorEstoque, 0);
  const valorB = abc.classes.B.reduce((s, i) => s + i.valorEstoque, 0);
  const valorC = abc.classes.C.reduce((s, i) => s + i.valorEstoque, 0);

  const pctValA = abc.valorTotalEstoque > 0 ? Math.round((valorA / abc.valorTotalEstoque) * 100) : 0;
  const pctValB = abc.valorTotalEstoque > 0 ? Math.round((valorB / abc.valorTotalEstoque) * 100) : 0;
  const pctValC = abc.valorTotalEstoque > 0 ? Math.round((valorC / abc.valorTotalEstoque) * 100) : 0;

  const todosItens = [
    ...abc.classes.A.map((i) => ({ ...i, classe: 'A' as const })),
    ...abc.classes.B.map((i) => ({ ...i, classe: 'B' as const })),
    ...abc.classes.C.map((i) => ({ ...i, classe: 'C' as const })),
  ].sort((a, b) => b.valorEstoque - a.valorEstoque);

  const acuracidade = calcularAcuracidade(materiais, contagens);

  const classeBadge = (classe: 'A' | 'B' | 'C') => {
    if (classe === 'A') return { background: 'var(--text-main)', color: 'var(--bg-body)' };
    if (classe === 'B') return { background: 'var(--text-muted)', color: '#fff' };
    return { background: 'var(--border-color)', color: 'var(--text-main)' };
  };

  const acuracidadeColor = (v: number) => (v < 100 ? 'var(--warning)' : 'var(--success)');

  return (
    <div>
      {/* KPIs */}
      <div className="stats-container animate-fade-in">
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-boxes"></i> Valor Total em Estoque</div>
          <div className="stat-number">{formatarMoeda(abc.valorTotalEstoque)}</div>
          <div className="stat-desc">Valoração total dos ativos deste contrato</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fas fa-percentage"></i> Acuracidade Geral</div>
          <div className="stat-number">{acuracidade.taxaAcuracidade}%</div>
          <div className="stat-desc">Média ponderada física da contagem</div>
        </div>
      </div>

      {/* Cards ABC */}
      <div className="curva-grid animate-fade-in">
        {(
          [
            { classe: 'A', label: 'Alta Relevância', total: totalA, pct: pctA, valor: valorA, pctVal: pctValA },
            { classe: 'B', label: 'Média Relevância', total: totalB, pct: pctB, valor: valorB, pctVal: pctValB },
            { classe: 'C', label: 'Baixa Relevância', total: totalC, pct: pctC, valor: valorC, pctVal: pctValC },
          ] as const
        ).map(({ classe, label, total, pct, valor, pctVal }) => (
          <div key={classe} className={`curva-box classe-${classe}`}>
            <div className="curva-header">
              <div className="curva-title">Classe {classe}</div>
              <div className="curva-val">{label}</div>
            </div>
            <div className="curva-stat">
              <span>Itens Cadastrados</span>
              <span>{total} itens ({pct}%)</span>
            </div>
            <div className="curva-stat">
              <span>Valor em Estoque</span>
              <span>{formatarMoeda(valor)} ({pctVal}%)</span>
            </div>
            <div className="curva-stat">
              <span>Acuracidade Física</span>
              <span style={{ color: acuracidadeColor(abc.acuracidadePorClasse[classe]) }}>
                {abc.acuracidadePorClasse[classe]}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabela Detalhada */}
      <div className="card animate-fade-in" style={{ marginTop: '2rem' }}>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: '1.15rem', marginBottom: '1rem' }}>
          <i className="fas fa-list"></i> Detalhes dos Itens Ordenados por Valor Patrimonial
        </h3>
        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Classe</th><th>Descrição do Item</th>
                <th>Saldo Sistema</th><th>Preço Unitário</th><th>Valor Patrimonial</th>
              </tr>
            </thead>
            <tbody>
              {todosItens.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="badge" style={classeBadge(item.classe)}>Classe {item.classe}</span>
                  </td>
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
    </div>
  );
}
