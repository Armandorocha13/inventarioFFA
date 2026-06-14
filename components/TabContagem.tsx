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
import type { PerfilAcesso } from '@/app/page';

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
  perfil?: PerfilAcesso;
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
  perfil,
}: TabContagemProps) {
  const prog = calcularProgresso(materiaisVisiveis, contagens);
  const stats = calcularAcuracidade(materiaisVisiveis, contagens);

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
        {perfil === 'contagem' ? (
          <>
            <div className="stat-card kpi-total" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Total de Materiais</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{prog.total}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Itens cadastrados no contrato</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-boxes"></i>
              </div>
            </div>

            <div className="stat-card kpi-contados" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Itens Auditados</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{prog.contados}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Itens com contagem física</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-check-double"></i>
              </div>
            </div>

            <div className="stat-card kpi-restantes" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Itens Restantes</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: (prog.total - prog.contados) > 0 ? 'var(--warning)' : 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{prog.total - prog.contados}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Aguardando contagem física</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: (prog.total - prog.contados) > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(107, 114, 128, 0.08)', color: (prog.total - prog.contados) > 0 ? '#d97706' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-hourglass-half"></i>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card kpi-acuracidade" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Acuracidade Física</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.taxaAcuracidade === 100 ? 'var(--success)' : stats.taxaAcuracidade >= 80 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'Quicksand, sans-serif' }}>{stats.taxaAcuracidade}%</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Percentual de acertos física/sistema</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: stats.taxaAcuracidade === 100 ? 'rgba(22, 163, 74, 0.08)' : stats.taxaAcuracidade >= 80 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(239, 68, 68, 0.08)', color: stats.taxaAcuracidade === 100 ? 'var(--success)' : stats.taxaAcuracidade >= 80 ? '#d97706' : 'var(--danger)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-bullseye"></i>
              </div>
            </div>

            <div className="stat-card kpi-contados" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Itens Auditados</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{stats.contados}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contagens físicas registradas</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-check-double"></i>
              </div>
            </div>

            <div className="stat-card kpi-divergentes" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', textAlign: 'left', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Itens Divergentes</span>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: stats.divergentes > 0 ? 'var(--warning)' : 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>{stats.divergentes}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Contagens com desvio físico</span>
              </div>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: stats.divergentes > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(107, 114, 128, 0.08)', color: stats.divergentes > 0 ? '#d97706' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fas fa-exclamation-circle"></i>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabela */}
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              {(
                [
                  { col: 'origem', label: 'Origem' },
                  { col: 'codmat', label: 'Código Mat.' },
                  { col: 'descricao', label: 'Descrição' },
                  { col: 'unidade', label: 'UN' },
                  ...(perfil !== 'contagem' ? [{ col: 'saldoAtual', label: 'Saldo Sistema' }] : []),
                ] as { col: keyof Material; label: string }[]
              ).map(({ col, label }) => (
                <th key={col} data-sort={col} onClick={() => onOrdenarColuna(col)} style={{ cursor: 'pointer' }}>
                  <i className={getSortIcon(col)}></i> {label}
                </th>
              ))}
              {perfil !== 'contagem' && <th>Curva</th>}
              {perfil !== 'contagem' && <th>Desvio</th>}
              <th>
                <i className={getSortIcon('ultimaAtualizacao')} onClick={() => onOrdenarColuna('ultimaAtualizacao')} style={{ cursor: 'pointer' }}></i> Última Atualização
              </th>
              <th>Contagem Física</th>
            </tr>
          </thead>
          <tbody>
            {materiaisVisiveis.length === 0 ? (
              <tr>
                <td colSpan={perfil === 'contagem' ? 6 : 9} className="text-center py-4 text-muted">Nenhum material encontrado.</td>
              </tr>
            ) : (
              materiaisVisiveis.map((m) => (
                <MaterialRow
                  key={m.id}
                  material={m}
                  contagem={contagens[m.id]}
                  onRegistrar={onRegistrarContagem}
                  perfil={perfil}
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
      
    </div>
  );
}

// ─── Sub-componente de linha da tabela ────────────────────────────────────────

interface MaterialRowProps {
  material: Material;
  contagem: { novaQtd: number; observacao: string } | undefined;
  onRegistrar: (id: number, novaQtd: number | null, observacao: string) => void;
  perfil?: PerfilAcesso;
}

function MaterialRow({ material: m, contagem, onRegistrar, perfil }: MaterialRowProps) {
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

  const classeColor = (cls: string | null | undefined) => {
    if (cls === 'A') return { background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' };
    if (cls === 'B') return { background: 'linear-gradient(135deg, #10b981, #047857)', color: '#fff' };
    return { background: 'linear-gradient(135deg, #f59e0b, #b45309)', color: '#fff' };
  };

  return (
    <tr data-id={m.id} className={isEditado ? 'linha-editada' : ''}>
      <td><strong>{sanitizarTexto(m.origem)}</strong></td>
      <td><span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>{m.codmat}</span></td>
      <td title={m.descricao}>{truncarTexto(m.descricao, 35)}</td>
      <td><span className="badge-unidade">{sanitizarTexto(m.unidade)}</span></td>
      {perfil !== 'contagem' && <td><span className={`badge ${badgeClass}`}>{m.saldoAtual}</span></td>}
      {perfil !== 'contagem' && (
        <td style={{ textAlign: 'center' }}>
          {m.classeABC ? (
            <span style={{ ...classeColor(m.classeABC), padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              {m.classeABC}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
          )}
        </td>
      )}
      {perfil !== 'contagem' && (
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
      )}
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
