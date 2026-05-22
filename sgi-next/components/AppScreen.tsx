'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import TabContagem from './TabContagem';
import TabMonitoramento from './TabMonitoramento';
import ModalConfirmacao from './ModalConfirmacao';
import type { useInventario } from '@/hooks/useInventario';
import type { AbaAtiva } from '@/hooks/useInventario';
import type { Material } from '@/lib/auxiliaresUI';

interface Almoxarifado {
  codigo: string;
  label: string;
  cidade: string;
  contrato: number;
}

interface AppScreenProps {
  uf: string;
  almoxarifados: Almoxarifado[];
  todos: Record<string, Almoxarifado[]>;
  inventario: ReturnType<typeof useInventario>;
  onVoltarLanding: () => void;
  toast: (msg: string, tipo: 'sucesso' | 'erro' | 'info') => void;
}

export default function AppScreen({
  uf,
  almoxarifados,
  todos,
  inventario,
  onVoltarLanding,
  toast,
}: AppScreenProps) {
  const { state, setAba, carregarMateriais, registrarContagem, restaurarContagens, setFiltroTermo, setFiltroTipo, ordenarColuna, gravarContagens } = inventario;
  const [codigoAlmox, setCodigoAlmox] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro');
  const [scrolled, setScrolled] = useState(false);

  // Scroll effect para header blur
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Tema
  const alternarTema = useCallback(() => {
    setTema((t) => {
      const novo = t === 'claro' ? 'escuro' : 'claro';
      document.documentElement.setAttribute('data-tema', novo);
      localStorage.setItem('sgi-tema', novo);
      return novo;
    });
  }, []);

  useEffect(() => {
    const temaLocal = localStorage.getItem('sgi-tema') as 'claro' | 'escuro' | null;
    if (temaLocal) {
      setTema(temaLocal);
      document.documentElement.setAttribute('data-tema', temaLocal);
    }
  }, []);

  // Rascunho
  const getChaveRascunho = (uf: string, almox: string) => {
    if (!almox) return null;
    if (almox === 'todos') return `sgi-draft-${uf || 'todos'}-todos`;
    return `sgi-draft-${almox}`;
  };

  const salvarRascunho = useCallback((almox: string, contagens: typeof state.contagens) => {
    const chave = getChaveRascunho(uf, almox);
    if (chave) localStorage.setItem(chave, JSON.stringify(contagens));
  }, [uf]);

  const handleRegistrarContagem = useCallback((id: number, novaQtd: number | null, observacao: string) => {
    registrarContagem(id, novaQtd, observacao);
  }, [registrarContagem]);

  // Depois de registrar, salva rascunho
  useEffect(() => {
    if (codigoAlmox) {
      salvarRascunho(codigoAlmox, state.contagens);
    }
  }, [state.contagens, codigoAlmox, salvarRascunho]);

  const handleAlmoxChange = useCallback(async (codigo: string) => {
    setCodigoAlmox(codigo);
    if (!codigo) return;
    try {
      let cidadesValidas: string[] | undefined = undefined;
      if (codigo === 'todos' && uf !== 'todos') {
        cidadesValidas = almoxarifados.map((a) => a.cidade);
      }
      const materiais = await carregarMateriais(codigo, cidadesValidas);
      // Restaura rascunho
      const chave = getChaveRascunho(uf, codigo);
      if (chave) {
        const salvo = localStorage.getItem(chave);
        if (salvo) {
          try {
            restaurarContagens(JSON.parse(salvo));
            toast('Rascunho recuperado com sucesso!', 'sucesso');
          } catch { /* ignora */ }
        }
      }
      toast(`Carregados ${materiais.length} itens`, 'info');
    } catch {
      toast('Falha ao conectar com o banco Neon.', 'erro');
    }
  }, [carregarMateriais, restaurarContagens, toast, uf, almoxarifados]);

  const handleSalvarContagens = useCallback(async () => {
    setSalvando(true);
    try {
      const idsEditados = Object.keys(state.contagens).map(Number);
      const payload = idsEditados.map((id) => {
        const mat = state.materiais.find((m) => m.id === id)!;
        const c = state.contagens[id];
        return {
          id: mat.id,
          origem: mat.origem,
          codmat: mat.codmat,
          descricao: mat.descricao,
          valorAnterior: mat.saldoAtual,
          valorNovo: c.novaQtd,
          observacao: c.observacao,
        };
      });
      await gravarContagens(payload);
      setModalAberto(false);
      toast(`${payload.length} contagens gravadas com sucesso!`, 'sucesso');
      // Mantém o rascunho para não zerar a tela ao dar F5
      const chave = getChaveRascunho(uf, codigoAlmox);
      // if (chave) localStorage.removeItem(chave); // Removido para manter a sessão
      // Recarrega materiais
      await carregarMateriais(codigoAlmox);
    } catch {
      toast('Erro ao gravar contagens no banco.', 'erro');
    } finally {
      setSalvando(false);
    }
  }, [state.contagens, state.materiais, gravarContagens, carregarMateriais, codigoAlmox, uf, toast]);

  const todasUFs = Object.keys(todos).sort();
  const almoxsParaSelect: Almoxarifado[] =
    uf === 'todos'
      ? Object.values(todos).flat()
      : almoxarifados;

  const tabLabel = (aba: AbaAtiva) => {
    if (aba === 'contagem') return 'Contagem Ativa';
    return 'Painel de Monitoramento';
  };

  return (
    <div id="appScreen">
      {/* Header */}
      <header id="mainHeader" className={`app-header${scrolled ? ' scrolled' : ''}`}>
        <nav className="app-nav">
          <div className="app-logo-wrap" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Image src="/logo.png" alt="FFA" className="app-logo-img" width={80} height={40} style={{ objectFit: 'contain' }} />
            <span className="app-title-text" style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text)' }}>FFA - Plataforma de Inventário</span>
          </div>

          <div className="app-nav-tabs" id="tabsNav">
            {(['contagem', 'monitoramento'] as AbaAtiva[]).map((aba) => (
              <button
                key={aba}
                className={`app-tab${state.abaAtiva === aba ? ' active' : ''}`}
                onClick={() => setAba(aba)}
                disabled={!codigoAlmox}
              >
                {tabLabel(aba)}
              </button>
            ))}
          </div>

          <div className="app-nav-actions">
            <button className="btn-icon" title="Início / Trocar Base" onClick={onVoltarLanding} style={{ marginRight: '10px' }}>
              <i className="fas fa-home"></i>
            </button>
            <button id="btnTema" className="btn-icon" title="Alternar Tema" onClick={alternarTema}>
              <i className={`fas fa-${tema === 'claro' ? 'moon' : 'sun'}`}></i>
            </button>
            <button
              id="btnMenuMobile"
              className="btn-icon btn-menu-mobile"
              aria-label="Menu"
              aria-expanded={menuMobileAberto}
              onClick={() => setMenuMobileAberto((v) => !v)}
            >
              <i className={`fas fa-${menuMobileAberto ? 'times' : 'bars'}`}></i>
            </button>
          </div>
        </nav>
      </header>

      {/* Menu Mobile */}
      {menuMobileAberto && (
        <div id="mobileMenu" className="mobile-menu">
          <div className="mobile-menu-inner">
            <div className="mobile-menu-links">
              {(['contagem', 'monitoramento'] as AbaAtiva[]).map((aba) => (
                <button
                  key={aba}
                  className={`app-tab-mobile${state.abaAtiva === aba ? ' active' : ''}`}
                  onClick={() => { setAba(aba); setMenuMobileAberto(false); }}
                  disabled={!codigoAlmox}
                >
                  {tabLabel(aba)}
                </button>
              ))}
            </div>
            <hr className="mobile-divider" />
            <div className="mobile-menu-actions">
              <button className="mobile-action-btn" onClick={() => { alternarTema(); setMenuMobileAberto(false); }}>
                <i className={`fas fa-${tema === 'claro' ? 'moon' : 'sun'}`}></i> Alternar Tema
              </button>
              <button className="mobile-action-btn" onClick={() => { onVoltarLanding(); setMenuMobileAberto(false); }}>
                <i className="fas fa-arrow-left"></i> Trocar Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="app-main">
        {/* Filtros */}
        <section className="card filters-card app-filters">
          <div className="filtros-grid">
            <div className="form-group">
              <label htmlFor="uf2"><i className="fas fa-map-marker-alt"></i> Estado (UF)</label>
              <select id="uf2" className="form-control" value={uf} disabled>
                <option value={uf}>{uf === 'todos' ? 'Todas as bases' : uf}</option>
                {todasUFs.filter((u) => u !== uf).map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="almox2"><i className="fas fa-file-contract"></i> CONTRATO</label>
              <select
                id="almox2"
                className="form-control"
                value={codigoAlmox}
                onChange={(e) => handleAlmoxChange(e.target.value)}
              >
                <option value="">Selecione o contrato...</option>
                <option value="todos">Todos os contratos</option>
                {almoxsParaSelect.map((a) => (
                  <option key={a.codigo} value={a.codigo}>{a.label}</option>
                ))}
              </select>
            </div>
            {codigoAlmox && (
              <>
                <div className="form-group" id="grupoBusca">
                  <label htmlFor="searchInput"><i className="fas fa-search"></i> Buscar Material</label>
                  <input
                    type="text"
                    id="searchInput"
                    className="form-control"
                    placeholder="Descrição, origem..."
                    value={state.filtros.termo}
                    onChange={(e) => setFiltroTermo(e.target.value)}
                  />
                </div>
                <div className="form-group" id="grupoTipo">
                  <label htmlFor="tipoFilter"><i className="fas fa-tags"></i> Tipo de Material</label>
                  <select
                    id="tipoFilter"
                    className="form-control"
                    value={state.filtros.tipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                  >
                    <option value="todos">Todos os materiais</option>
                    {Array.from(new Set(state.materiais.map((m) => m.descricao))).filter(Boolean).sort().map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Área de Conteúdo */}
        <div id="abaConteudo" className="tab-content-area">
          {!codigoAlmox ? (
            <div className="empty-state-container animate-fade-in">
              <div className="empty-state-icon">
                <i className="fas fa-warehouse bounce-slow"></i>
              </div>
              <h2 className="empty-state-title">Nenhum Contrato Selecionado</h2>
              <p className="empty-state-text">
                Selecione um contrato no painel de filtros acima para visualizar e auditar o estoque.
              </p>
            </div>
          ) : state.carregando ? (
            <div className="empty-state-container animate-fade-in">
              <div className="empty-state-icon">
                <i className="fas fa-spinner fa-spin"></i>
              </div>
              <p className="empty-state-text">Carregando materiais...</p>
            </div>
          ) : (
            <>
              {state.abaAtiva === 'contagem' && (
                <TabContagem
                  materiais={state.materiais}
                  materiaisVisiveis={state.materiaisVisiveis}
                  contagens={state.contagens}
                  colunaOrdenacao={state.colunaOrdenacao}
                  direcaoOrdenacao={state.direcaoOrdenacao}
                  codigoAlmox={codigoAlmox}
                  onRegistrarContagem={handleRegistrarContagem}
                  onOrdenarColuna={ordenarColuna}
                  onAbrirModal={() => setModalAberto(true)}
                  setAba={setAba}
                />
              )}
              {state.abaAtiva === 'monitoramento' && (
                <TabMonitoramento materiais={state.materiaisVisiveis} contagens={state.contagens} />
              )}
            </>
          )}
        </div>
      </main>

      {/* Toast Container */}
      <div id="toastContainer"></div>

      {/* Modal */}
      {modalAberto && (
        <ModalConfirmacao
          materiais={state.materiais}
          contagens={state.contagens}
          salvando={salvando}
          onConfirmar={handleSalvarContagens}
          onCancelar={() => setModalAberto(false)}
        />
      )}
    </div>
  );
}
