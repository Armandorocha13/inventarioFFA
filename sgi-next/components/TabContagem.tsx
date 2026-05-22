'use client';

import { useRef, useCallback, useEffect } from 'react';
import {
  calcularAcuracidade,
  calcularProgresso,
  getBadgeClass,
  formatarData,
  sanitizarTexto,
  truncarTexto,
} from '@/lib/auxiliaresUI';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';
import type { AbaAtiva } from '@/hooks/useInventario';
import { prepararDadosExport, gerarNomeArquivo } from '@/lib/exportacao';

interface TabContagemProps {
  materiais: Material[];
  materiaisVisiveis: Material[];
  contagens: ContagensMap;
  colunaOrdenacao: keyof Material | null;
  direcaoOrdenacao: 'asc' | 'desc';
  codigoAlmox: string;
  onRegistrarContagem: (id: number, novaQtd: number | null, observacao: string) => void;
  onOrdenarColuna: (coluna: keyof Material) => void;
  onAbrirModal: () => void;
  setAba: (aba: AbaAtiva) => void;
}

export default function TabContagem({
  materiais,
  materiaisVisiveis,
  contagens,
  colunaOrdenacao,
  direcaoOrdenacao,
  codigoAlmox,
  onRegistrarContagem,
  onOrdenarColuna,
  onAbrirModal,
  setAba,
}: TabContagemProps) {
  const prog = calcularProgresso(materiais, contagens);
  const stats = calcularAcuracidade(materiais, contagens);

  const exportarExcel = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Carrega XLSX via CDN (já disponível no HTML via script tag, ou dinâmico)
    const XLSX = (window as Window & { XLSX?: { utils: { json_to_sheet: (d: unknown) => unknown; book_new: () => unknown; book_append_sheet: (wb: unknown, ws: unknown, name: string) => void }; writeFile: (wb: unknown, name: string) => void } }).XLSX;
    if (!XLSX) {
      alert('Biblioteca XLSX não carregada.');
      return;
    }
    const contagensArr = Object.entries(contagens).map(([id, c]) => ({
      id: Number(id),
      novaQtd: c.novaQtd,
      observacao: c.observacao,
    }));
    const dados = prepararDadosExport(materiais, contagens);
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contagem');
    XLSX.writeFile(wb, gerarNomeArquivo(codigoAlmox));
    void contagensArr;
  }, [materiais, contagens, codigoAlmox]);

  const getSortIcon = (col: keyof Material) => {
    if (colunaOrdenacao !== col) return 'fas fa-sort sort-icon';
    return direcaoOrdenacao === 'asc' ? 'fas fa-sort-up sort-icon' : 'fas fa-sort-down sort-icon';
  };

  return (
    <div>
      {/* KPIs */}
      <div className="stats-container animate-fade-in">
        <div className="stat-card kpi-acuracidade">
          <div className="stat-label"><i className="fas fa-bullseye"></i> Acuracidade Física</div>
          <div className="stat-number">{stats.taxaAcuracidade}%</div>
          <div className="stat-desc">Percentual de acertos dos itens contados</div>
        </div>
        <div className="stat-card kpi-contados">
          <div className="stat-label"><i className="fas fa-check-double"></i> Itens Auditados</div>
          <div className="stat-number">{stats.contados}</div>
          <div className="stat-desc">Aguardando contagem física</div>
        </div>
        <div className="stat-card kpi-divergentes">
          <div className="stat-label"><i className="fas fa-exclamation-circle"></i> Itens Divergentes</div>
          <div className="stat-number">{stats.divergentes}</div>
          <div className="stat-desc">Contagens físicas divergentes</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              {(
                [
                  { col: 'origem', label: 'Origem' },
                  { col: 'descricao', label: 'Descrição' },
                  { col: 'unidade', label: 'UN' },
                  { col: 'saldoAtual', label: 'Saldo Sistema' },
                ] as { col: keyof Material; label: string }[]
              ).map(({ col, label }) => (
                <th key={col} data-sort={col} onClick={() => onOrdenarColuna(col)} style={{ cursor: 'pointer' }}>
                  <i className={getSortIcon(col)}></i> {label}
                </th>
              ))}
              <th>Desvio</th>
              <th>
                <i className={getSortIcon('ultimaAtualizacao')} onClick={() => onOrdenarColuna('ultimaAtualizacao')} style={{ cursor: 'pointer' }}></i> Última Atualização
              </th>
              <th>Contagem Física</th>
            </tr>
          </thead>
          <tbody>
            {materiaisVisiveis.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted">Nenhum material encontrado.</td>
              </tr>
            ) : (
              materiaisVisiveis.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  contagem={contagens[m.id]}
                  onRegistrar={onRegistrarContagem}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de Ações */}
      <div className="actions-bar">
        <div className="progress-container">
          <div className="progress-header">
            <span>{prog.contados} de {prog.total} itens contados</span>
          </div>
          <div className="progress-track">
            <div id="progressoBarra" className="progress-fill" style={{ width: `${prog.percentual}%` }} />
          </div>
        </div>
        <div className="buttons-group">
          <button className="btn btn-secondary btn-excel" onClick={exportarExcel}>
            <i className="fas fa-file-excel"></i> Exportar
          </button>
          <button
            id="btnSalvar"
            className="btn btn-primary"
            disabled={prog.contados === 0}
            onClick={onAbrirModal}
          >
            <i className="fas fa-save"></i> Gravar Contagem
          </button>
        </div>
      </div>
      
      {/* Atalho para Monitoramento */}
      {prog.contados > 0 && (
        <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => setAba('monitoramento')}>
            <i className="fas fa-chart-bar"></i> Ver Painel de Monitoramento
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente de linha da tabela ────────────────────────────────────────

interface MaterialRowProps {
  material: Material;
  contagem: { novaQtd: number; observacao: string } | undefined;
  onRegistrar: (id: number, novaQtd: number | null, observacao: string) => void;
}

function MaterialRow({ material: m, contagem, onRegistrar }: MaterialRowProps) {
  const qtdRef = useRef<HTMLInputElement>(null);

  const badgeClass = getBadgeClass(m.saldoAtual);
  const dataFmt = formatarData(m.ultimaAtualizacao);
  const isEditado = contagem !== undefined;

  const desvio = isEditado ? contagem.novaQtd - m.saldoAtual : null;

  const handleChange = useCallback(() => {
    const qtd = qtdRef.current?.value ?? '';
    if (qtd === '' || qtd === null) {
      onRegistrar(m.id, null, '');
    } else {
      onRegistrar(m.id, Number(qtd), '');
    }
  }, [m.id, onRegistrar]);

  // Sincroniza inputs com estado externo (quando rascunho é restaurado)
  useEffect(() => {
    if (qtdRef.current && contagem !== undefined) {
      qtdRef.current.value = String(contagem.novaQtd);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <tr data-id={m.id} className={isEditado ? 'linha-editada' : ''}>
      <td><strong>{sanitizarTexto(m.origem)}</strong></td>
      <td title={m.descricao}>{truncarTexto(m.descricao, 35)}</td>
      <td><span className="badge-unidade">{sanitizarTexto(m.unidade)}</span></td>
      <td><span className={`badge ${badgeClass}`}>{m.saldoAtual}</span></td>
      <td className="desvio-cell">
        {desvio === null ? (
          <span className="badge-diff igual">—</span>
        ) : desvio === 0 ? (
          <span className="badge-diff igual" style={{ backgroundColor: 'rgba(108,117,125,0.1)', color: '#6c757d', padding: '4px 8px', borderRadius: '12px' }}><i className="fas fa-check"></i> 0</span>
        ) : desvio > 0 ? (
          <span className="badge-diff sobra" style={{ backgroundColor: 'rgba(40,167,69,0.1)', color: '#28a745', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}><i className="fas fa-arrow-up"></i> +{desvio}</span>
        ) : (
          <span className="badge-diff falta" style={{ backgroundColor: 'rgba(220,53,69,0.1)', color: '#dc3545', padding: '4px 8px', borderRadius: '12px', fontWeight: 'bold' }}><i className="fas fa-arrow-down"></i> {desvio}</span>
        )}
      </td>
      <td><span className="data-badge">{dataFmt}</span></td>
      <td>
        <input
          ref={qtdRef}
          type="number"
          className="qty-input"
          min="0"
          placeholder="0"
          defaultValue={contagem ? contagem.novaQtd : ''}
          onChange={handleChange}
        />
      </td>
    </tr>
  );
}
