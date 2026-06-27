'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import TabContagem from './TabContagem';
import TabMonitoramento from './TabMonitoramento';
import TabUpload from './TabUpload';
import ModalConfirmacao from './ModalConfirmacao';
import ModalMaterialExtra from './ModalMaterialExtra';
import type { useInventario } from '@/hooks/useInventario';
import type { AbaAtiva } from '@/hooks/useInventario';
import type { ContagensMap } from '@/lib/domain/types';
import { padronizarNomeCidade } from '@/lib/filtros';

interface Almoxarifado {
  codigo: string;
  label: string;
  cidade: string;
  contrato: number;
}

import type { PerfilAcesso } from '@/app/page';

interface AppScreenProps {
  uf: string;
  almoxarifados: Almoxarifado[];
  todos: Record<string, Almoxarifado[]>;
  inventario: ReturnType<typeof useInventario>;
  perfil: PerfilAcesso;
  onVoltarLanding: () => void;
  toast: (msg: string, tipo: 'sucesso' | 'erro' | 'info') => void;
}

export default function AppScreen({
  uf,
  almoxarifados,
  todos,
  inventario,
  perfil,
  onVoltarLanding,
  toast,
}: AppScreenProps) {
  const { state, setAba, carregarMateriais, registrarContagem, restaurarContagens, setFiltroTipo, setFiltroGrupo, ordenarColuna, gravarContagens } = inventario;
  const [codigoAlmox, setCodigoAlmox] = useState('');
  const [abaAnterior, setAbaAnterior] = useState<AbaAtiva>('monitoramento');
  const [modalAberto, setModalAberto] = useState(false);
  const [modalAddExtraAberto, setModalAddExtraAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [tema, setTema] = useState<'claro' | 'escuro'>('claro');
  const [scrolled, setScrolled] = useState(false);

  // Novos filtros dinâmicos
  const [filtroEstado, setFiltroEstado] = useState(uf || 'todos');
  const [filtroClasse, setFiltroClasse] = useState('todas');
  const [filtroAuditado, setFiltroAuditado] = useState<'todos' | 'sim' | 'nao'>('todos');

  const NOME_ESTADOS: Record<string, string> = {
    RJ: 'Rio de Janeiro',
    ES: 'Espírito Santo',
    SP: 'São Paulo',
    PR: 'Paraná',
    MG: 'Minas Gerais',
  };

  const matchEstado = useCallback((m: any, est: string) => {
    if (est === 'todos') return true;
    let matUf = 'RJ';
    const origemUpper = (m.origem || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (origemUpper === 'ESPIRITO SANTO') matUf = 'ES';
    else if (origemUpper === 'SAO PAULO') matUf = 'SP';
    else if (origemUpper === 'CURITIBA') matUf = 'PR';
    else if (['UBERLANDIA', 'VALADARES', 'BELO HORIZONTE', 'JUIZ DE FORA', 'VARGINHA'].includes(origemUpper)) matUf = 'MG';
    else if (origemUpper === 'CAMPO GRANDE') matUf = 'MS';
    return matUf === est;
  }, []);

  const matchProjeto = useCallback((m: any, almoxCode: string) => {
    if (!almoxCode || almoxCode === 'todos') return true;
    const parts = almoxCode.split('|');
    const cidade = parts[0];
    const contrato = parts[1] ? parseInt(parts[1], 10) : NaN;
    const projeto = parts[2];
    
    const mCity = padronizarNomeCidade(m.grupo || '');
    const mContrato = m.contrato;
    const mProjeto = m.grupo;
    
    const cityMatch = !cidade || m.origem?.toUpperCase() === cidade.toUpperCase() || mCity.toUpperCase() === cidade.toUpperCase();
    const contractMatch = isNaN(contrato) || mContrato === undefined || mContrato === contrato;
    const projectMatch = !projeto || mProjeto === undefined || mProjeto === projeto;
    
    return cityMatch && contractMatch && projectMatch;
  }, []);

  const matchClasse = useCallback((m: any, cl: string) => {
    if (cl === 'todas') return true;
    const abc = m.classeABC || 'C';
    return abc.toUpperCase() === cl.toUpperCase();
  }, []);

  const matchAuditado = useCallback((m: any, aud: string) => {
    if (aud === 'todos') return true;
    const foiAuditado = m.id in state.contagens;
    return aud === 'sim' ? foiAuditado : !foiAuditado;
  }, [state.contagens]);

  const matchCidade = useCallback((m: any, cid: string) => {
    if (cid === 'todas') return true;
    return padronizarNomeCidade(m.grupo || '') === cid;
  }, []);

  const matchTipo = useCallback((m: any, tp: string) => {
    if (tp === 'todos') return true;
    return m.descricao === tp;
  }, []);

  // 1. Estado (UF) options: UFs where there is at least one material in the loaded dataset
  const ufsDisponiveis = Array.from(new Set(
    state.materiais
      .map(m => {
        const origemUpper = (m.origem || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (origemUpper === 'ESPIRITO SANTO') return 'ES';
        if (origemUpper === 'SAO PAULO') return 'SP';
        if (origemUpper === 'CURITIBA') return 'PR';
        if (['UBERLANDIA', 'VALADARES', 'BELO HORIZONTE', 'JUIZ DE FORA', 'VARGINHA'].includes(origemUpper)) return 'MG';
        if (origemUpper === 'CAMPO GRANDE') return 'MS';
        return 'RJ';
      })
  )).sort();

  // 2. Projeto options: projects belonging to the selected state (Estado) and selected city (Cidade)
  const baseProjetos = uf === 'todos' ? Object.values(todos).flat() : almoxarifados;
  const projetosFiltrados = baseProjetos.filter(projOpt => {
    // Filter by Estado
    if (filtroEstado !== 'todos') {
      let contractUf = 'RJ';
      const cityUpper = (projOpt.cidade || '').toUpperCase();
      if (cityUpper === 'ESPIRITO SANTO' || cityUpper === 'ESPÍRITO SANTO') contractUf = 'ES';
      else if (cityUpper === 'SÃO PAULO' || cityUpper === 'SAO PAULO') contractUf = 'SP';
      else if (cityUpper === 'CURITIBA') contractUf = 'PR';
      else if (cityUpper === 'MINAS GERAIS') contractUf = 'MG';
      if (contractUf !== filtroEstado) return false;
    }

    // Filter by Cidade
    const selectedCidade = state.filtros.grupo;
    if (selectedCidade && selectedCidade !== 'todas') {
      const projCityNorm = (projOpt.cidade || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const selCityNorm = selectedCidade.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

      // Equivalent check (Vitória / Espírito Santo)
      const matchCity = projCityNorm === selCityNorm || 
                        (projCityNorm === 'ESPIRITO SANTO' && selCityNorm === 'VITORIA') ||
                        (projCityNorm === 'VITORIA' && selCityNorm === 'ESPIRITO SANTO');

      if (!matchCity) return false;
    }

    return true;
  });

  // 3. Classe options: static classes present in the loaded dataset
  const classesDisponiveis = Array.from(new Set(
    state.materiais
      .map(m => (m.classeABC || 'C').toUpperCase())
  )).sort();

  // 4. Cidade options: cities belonging to the selected state (Estado) and selected project (Contrato)
  const cidadesDisponiveis = Array.from(new Set(
    state.materiais
      .filter(m => 
        matchEstado(m, filtroEstado) &&
        matchProjeto(m, codigoAlmox)
      )
      .map(m => padronizarNomeCidade(m.grupo || ''))
      .filter(Boolean)
  )).sort();

  // 5. Tipo de Material options: material types belonging to the selected state, project, and city
  const tiposDisponiveis = Array.from(new Set(
    state.materiais
      .filter(m => 
        matchEstado(m, filtroEstado) &&
        matchProjeto(m, codigoAlmox) &&
        matchCidade(m, state.filtros.grupo)
      )
      .map(m => m.descricao)
      .filter(Boolean)
  )).sort();



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
      // Restaura o tema salvo após a montagem. O setState no effect é
      // intencional: ler localStorage no estado inicial causaria mismatch
      // de hidratação (o servidor não tem acesso ao localStorage).
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const salvarRascunho = useCallback((almox: string, contagens: ContagensMap) => {
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
      // Restaura rascunho apenas para perfil de contagem (Auditor)
      if (perfil === 'contagem') {
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
      }
      toast(`Carregados ${materiais.length} itens`, 'info');
    } catch {
      toast('Falha ao conectar com o banco Neon.', 'erro');
    }
  }, [carregarMateriais, restaurarContagens, toast, uf, almoxarifados, perfil]);

  // Resets for invalid filter selections when options list changes
  useEffect(() => {
    if (codigoAlmox && codigoAlmox !== 'todos') {
      const exists = projetosFiltrados.some(p => p.codigo === codigoAlmox);
      if (!exists) {
        handleAlmoxChange('todos');
      }
    }
  }, [projetosFiltrados, codigoAlmox, handleAlmoxChange]);

  useEffect(() => {
    const selectedCidade = state.filtros.grupo;
    if (selectedCidade && selectedCidade !== 'todas' && !cidadesDisponiveis.includes(selectedCidade)) {
      setFiltroGrupo('todas');
    }
  }, [cidadesDisponiveis, state.filtros.grupo, setFiltroGrupo]);

  useEffect(() => {
    const selectedTipo = state.filtros.tipo;
    if (selectedTipo && selectedTipo !== 'todos' && !tiposDisponiveis.includes(selectedTipo)) {
      setFiltroTipo('todos');
    }
  }, [tiposDisponiveis, state.filtros.tipo, setFiltroTipo]);

  // Entrar direto se for Monitoramento (após handleAlmoxChange estar definido).
  // Carregamento de dados na montagem — o setState (via handleAlmoxChange) é
  // intencional; o guard !codigoAlmox garante execução única.
  useEffect(() => {
    if (perfil === 'monitoramento' && !codigoAlmox) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handleAlmoxChange('todos');
    }
  }, [perfil, codigoAlmox, handleAlmoxChange]);

  const handleEstadoChange = useCallback((estado: string) => {
    setFiltroEstado(estado);
    setFiltroGrupo('todas'); // Limpa cidade ao mudar Estado
    
    // Reset selected contract if it does not belong to the selected state
    if (estado !== 'todos' && codigoAlmox !== 'todos' && codigoAlmox !== '') {
      const base = uf === 'todos' ? Object.values(todos).flat() : almoxarifados;
      const selectAlmox = base.find((a) => a.codigo === codigoAlmox);
      if (selectAlmox) {
        let contractUf = 'RJ';
        const cityUpper = (selectAlmox.cidade || '').toUpperCase();
        if (cityUpper === 'ESPIRITO SANTO' || cityUpper === 'ESPÍRITO SANTO') contractUf = 'ES';
        else if (cityUpper === 'SÃO PAULO' || cityUpper === 'SAO PAULO') contractUf = 'SP';
        else if (cityUpper === 'CURITIBA') contractUf = 'PR';
        else if (cityUpper === 'MINAS GERAIS') contractUf = 'MG';
        if (contractUf !== estado) {
          handleAlmoxChange('todos');
        }
      }
    }
  }, [codigoAlmox, uf, todos, almoxarifados, handleAlmoxChange, setFiltroGrupo]);

  const handleCidadeChange = useCallback((cidade: string) => {
    setFiltroGrupo(cidade);
  }, [setFiltroGrupo]);

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
          grupo: mat.grupo,
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
      if (chave) localStorage.removeItem(chave);
      // Recarrega materiais
      await carregarMateriais(codigoAlmox);
    } catch {
      toast('Erro ao gravar contagens no banco.', 'erro');
    } finally {
      setSalvando(false);
    }
  }, [state.contagens, state.materiais, gravarContagens, carregarMateriais, codigoAlmox, uf, toast]);

  const handleAdicionarItemExtra = useCallback(async (dados: {
    codmat: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
  }) => {
    // Parse origin and contrato from codigoAlmox  (format: CIDADE|CONTRATO|PROJETO or CIDADE|CONTRATO)
    const parts = codigoAlmox.split('|');
    const origem = parts[0];
    const contrato = parseInt(parts[1] || '0', 10);
    const grupo = parts[2] || parts[0];

    const res = await fetch('/api/materiais/extra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem, contrato, grupo, ...dados }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro desconhecido ao inserir item extra');
    }
    setModalAddExtraAberto(false);
    toast('Item extra adicionado e contagem registrada!', 'sucesso');
    await carregarMateriais(codigoAlmox);
  }, [codigoAlmox, carregarMateriais, toast]);

  const todasUFs = Object.keys(todos).sort();

  // Dynamic frontend filtering for Estado, Classificacao, and Auditado
  const materiaisBase = state.materiaisVisiveis.filter((m) => {
    return matchEstado(m, filtroEstado) && matchAuditado(m, filtroAuditado);
  });

  // Cálculo Dinâmico da Curva ABC Relativo aos filtros ativos
  const itensComValor = materiaisBase.map(m => ({
    ...m,
    valorEstoqueTemp: (m.saldoAtual || 0) * (m.precoUnitario || 0)
  }));
  itensComValor.sort((a, b) => b.valorEstoqueTemp - a.valorEstoqueTemp);
  
  const valorTotalEstoque = itensComValor.reduce((acc, m) => acc + m.valorEstoqueTemp, 0);
  let somaAcumulada = 0;
  
  const mapClasseABC = new Map<number, string>();
  itensComValor.forEach((m) => {
    somaAcumulada += m.valorEstoqueTemp;
    const percentual = valorTotalEstoque > 0 ? somaAcumulada / valorTotalEstoque : 0;
    if (percentual <= 0.8) mapClasseABC.set(m.id, 'A');
    else if (percentual <= 0.95) mapClasseABC.set(m.id, 'B');
    else mapClasseABC.set(m.id, 'C');
  });

  const materiaisComClasse = materiaisBase.map(m => ({
    ...m,
    classeABC: mapClasseABC.get(m.id) || 'C'
  }));

  const materiaisFiltrados = materiaisComClasse.filter((m) => {
    // 2. Filter by Classificação
    if (filtroClasse !== 'todas') {
      return m.classeABC === filtroClasse.toUpperCase();
    }
    return true;
  });

  return (
    <div id="appScreen">
      {/* Header */}
      <header id="mainHeader" className={`app-header${scrolled ? ' scrolled' : ''}`}>
        <nav className="app-nav">
          <div className="app-logo-wrap" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 8px' }}>
            <Image src="/logo.png" alt="FFA Logo" className="app-logo-img" width={48} height={24} style={{ objectFit: 'contain' }} />
            <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border-color)', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: '1.2' }}>FFA INFRAESTRUTURA</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '1.2' }}>Sistema de Inventário</span>
            </div>
          </div>

          {/* Abas removidas por redundância pós-login dinâmico */}

          <div className="app-nav-actions">
            {state.abaAtiva !== 'upload' && (
              <button
                className="btn-icon"
                title="Atualizar Saldo (Upload Excel)"
                onClick={() => {
                  setAbaAnterior(state.abaAtiva);
                  setAba('upload');
                }}
                style={{ marginRight: '10px' }}
              >
                <i className="fas fa-cloud-upload-alt"></i>
              </button>
            )}
            {perfil === 'monitoramento' ? (
              <button className="btn-icon" title="Sair do Sistema" onClick={onVoltarLanding} style={{ marginRight: '10px' }}>
                <i className="fas fa-sign-out-alt"></i>
              </button>
            ) : (
              <button className="btn-icon" title="Início / Sair" onClick={onVoltarLanding} style={{ marginRight: '10px' }}>
                <i className="fas fa-home"></i>
              </button>
            )}
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
            {/* Abas mobile removidas */}
            <hr className="mobile-divider" />
            <div className="mobile-menu-actions">
              {state.abaAtiva !== 'upload' && (
                <button className="mobile-action-btn" onClick={() => { setAbaAnterior(state.abaAtiva); setAba('upload'); setMenuMobileAberto(false); }}>
                  <i className="fas fa-cloud-upload-alt"></i> Atualizar Saldo (Upload)
                </button>
              )}
              <button className="mobile-action-btn" onClick={() => { alternarTema(); setMenuMobileAberto(false); }}>
                <i className={`fas fa-${tema === 'claro' ? 'moon' : 'sun'}`}></i> Alternar Tema
              </button>
              <button className="mobile-action-btn" onClick={() => { onVoltarLanding(); setMenuMobileAberto(false); }}>
                <i className={perfil === 'monitoramento' ? "fas fa-sign-out-alt" : "fas fa-home"}></i> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="app-main">
        {/* Filtros da Aplicação */}
        {state.abaAtiva !== 'upload' && (
          <section className="card filters-card app-filters">
            <div className="filtros-grid">
              <div className="form-group">
                <label htmlFor="selectEstado"><i className="fas fa-map-marker-alt"></i> Estado (UF)</label>
                <select
                  id="selectEstado"
                  className="form-control"
                  value={filtroEstado}
                  onChange={(e) => handleEstadoChange(e.target.value)}
                >
                  <option value="todos">Todos os Estados</option>
                  {todasUFs.filter(ufSigla => ufsDisponiveis.includes(ufSigla) || ufSigla === filtroEstado).map((ufSigla) => (
                    <option key={ufSigla} value={ufSigla}>
                      {NOME_ESTADOS[ufSigla] || ufSigla}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="selectProjeto"><i className="fas fa-file-contract"></i> Projeto (Contrato)</label>
                <select
                  id="selectProjeto"
                  className="form-control"
                  value={codigoAlmox}
                  onChange={(e) => handleAlmoxChange(e.target.value)}
                >
                  <option value="">Selecione o contrato...</option>
                  <option value="todos">Todos os projetos</option>
                  {projetosFiltrados.map((a) => (
                    <option key={a.codigo} value={a.codigo}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="selectClasse"><i className="fas fa-tags"></i> Classificação (ABC)</label>
                <select
                  id="selectClasse"
                  className="form-control"
                  value={filtroClasse}
                  onChange={(e) => setFiltroClasse(e.target.value)}
                >
                  <option value="todas">Todas as Classes</option>
                  {['A', 'B', 'C'].filter(cls => classesDisponiveis.includes(cls) || cls === filtroClasse.toUpperCase()).map((cls) => (
                    <option key={cls} value={cls}>Classe {cls}</option>
                  ))}
                </select>
              </div>
              {state.abaAtiva === 'monitoramento' && (
                <div className="form-group">
                  <label htmlFor="selectAuditado"><i className="fas fa-clipboard-check"></i> Apenas Auditados</label>
                  <select
                    id="selectAuditado"
                    className="form-control"
                    value={filtroAuditado}
                    onChange={(e) => setFiltroAuditado(e.target.value as 'todos' | 'sim' | 'nao')}
                  >
                    <option value="todos">Todos</option>
                    <option value="sim">Sim</option>
                    <option value="nao">Não</option>
                  </select>
                </div>
              )}
              {codigoAlmox && (
                <>
                  <div className="form-group" id="grupoFiltroCidade">
                    <label htmlFor="cidadeFilter"><i className="fas fa-map-marker-alt"></i> Cidade</label>
                    <select
                      id="cidadeFilter"
                      className="form-control"
                      value={state.filtros.grupo}
                      onChange={(e) => handleCidadeChange(e.target.value)}
                    >
                      <option value="todas">Todas as cidades</option>
                      {cidadesDisponiveis.map((cityName) => (
                        <option key={cityName} value={cityName}>{cityName}</option>
                      ))}
                    </select>
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
                      {tiposDisponiveis.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* Área de Conteúdo */}
        <div id="abaConteudo" className="tab-content-area">
          {state.abaAtiva === 'upload' ? (
            <TabUpload 
              onVoltar={() => setAba(abaAnterior)}
              onUploadSuccess={async () => {
                if (codigoAlmox) {
                  await carregarMateriais(codigoAlmox);
                }
              }}
            />
          ) : !codigoAlmox ? (
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
                  materiaisVisiveis={materiaisFiltrados}
                  contagens={state.contagens}
                  colunaOrdenacao={state.colunaOrdenacao}
                  direcaoOrdenacao={state.direcaoOrdenacao}
                  codigoAlmox={codigoAlmox}
                  onRegistrarContagem={handleRegistrarContagem}
                  onOrdenarColuna={ordenarColuna}
                  onAbrirModal={() => setModalAberto(true)}
                  onAbrirModalAddExtra={() => setModalAddExtraAberto(true)}
                  setAba={setAba}
                  perfil={perfil}
                />
              )}
              {state.abaAtiva === 'monitoramento' && (
                <TabMonitoramento 
                  materiais={materiaisFiltrados} 
                  contagens={state.contagens}
                />
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
          perfil={perfil}
        />
      )}

      {modalAddExtraAberto && (
        <ModalMaterialExtra
          onConfirmar={handleAdicionarItemExtra}
          onCancelar={() => setModalAddExtraAberto(false)}
        />
      )}
    </div>
  );
}
