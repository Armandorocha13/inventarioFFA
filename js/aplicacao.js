/**
 * aplicacao.js — Orquestrador do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsável por ligar a interface (DOM) aos módulos lógicos puros.
 * Gerencia o estado da sessão atual (almoxarifado selecionado, contagens preenchidas).
 */

import { getEstados, getAlmoxarifados, getMateriais } from './dadosMock.js';
import { filtrarMateriais, ordenarPor, debounce } from './filtros.js';
import { validarContagens } from './validacao.js';
import { adicionarRegistro, limparHistorico } from './historico.js';
import { prepararDadosExport, gerarNomeArquivo } from './exportacao.js';
import { 
  formatarData, 
  getBadgeClass, 
  calcularProgresso, 
  sanitizarTexto, 
  truncarTexto, 
  formatarMoeda, 
  calcularAcuracidade, 
  calcularFinanceiroDivergencias, 
  classificarCurvaABC 
} from './auxiliaresUI.js';

// ─── Estado da Sessão ────────────────────────────────────────────────────────

const estado = {
  abaAtiva: 'contagem',  // 'contagem' | 'curvaABC' | 'monitoramento'
  materiais: [],        // Lista completa de materiais do almoxarifado atual
  materiaisVisiveis: [],// Lista filtrada/ordenada atualmente visível na tabela
  contagens: {},        // Mapa de contagens digitadas: { [id]: { novaQtd, observacao } }
  colunaOrdenacao: null,// Qual coluna está ordenando agora
  direcaoOrdenacao: 'asc', // 'asc' ou 'desc'
  filtros: {
    termo: '',
    tipo: 'todos'
  }
};

let abaEstruturaCarregada = null;

// ─── Inicialização ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  aplicarTema();
  inicializarLanding();
});

// ── Tela 1: Landing (seleção de base) ─────────────────────────────────────────

function inicializarLanding() {
  const selectUf = document.getElementById('uf');

  popularUFsEm(selectUf);

  selectUf.addEventListener('change', (e) => {
    const uf = e.target.value;
    if (!uf) return;
    // Passa null como almox — o picker será mostrado dentro do app
    iniciarCarregamento(uf, null);
  });
}

// ── Tela 2 → 3: Loading → App ─────────────────────────────────────────────────

function iniciarCarregamento(uf, codigoAlmox) {
  const landing = document.getElementById('landingScreen');
  const loading = document.getElementById('loadingScreen');
  const app     = document.getElementById('appScreen');

  landing.classList.add('fade-out');

  setTimeout(() => {
    landing.style.display = 'none';
    loading.style.display = 'flex';

    setTimeout(() => {
      loading.classList.add('fade-out');
      setTimeout(() => {
        loading.style.display = 'none';
        loading.classList.remove('fade-out');
        app.style.display = 'block';
        inicializarApp();

        if (codigoAlmox) {
          // Fluxo normal: já tem almox selecionado → carrega materiais
          carregarMateriais(uf, codigoAlmox);
          sincronizarFiltrosApp(uf, codigoAlmox);
          estado.abaAtiva = 'contagem';
          render();
          tentarCarregarRascunho(uf, codigoAlmox);
        } else {
          // Novo fluxo: configura filtros com UF e mostra estado vazio para seleção
          sincronizarFiltrosApp(uf, null);
          renderEstadoVazioSelecao();
        }
      }, 380);
    }, 750);
  }, 420);
}

// ── Estado Vazio e Seleção de Almoxarifado (dentro do App) ────────────────────

function renderEstadoVazioSelecao() {
  const container = document.getElementById('abaConteudo');
  if (!container) return;

  // Esconde filtros adicionais (busca e tipo) até selecionar o almoxarifado
  const grupoBusca = document.getElementById('grupoBusca');
  const grupoTipo  = document.getElementById('grupoTipo');
  if (grupoBusca) grupoBusca.style.visibility = 'hidden';
  if (grupoTipo)  grupoTipo.style.visibility = 'hidden';

  // Desabilita tabs
  document.querySelectorAll('#tabsNav .app-tab, .app-tab-mobile').forEach(b => {
    b.disabled = true;
    b.style.opacity = '0.35';
    b.style.pointerEvents = 'none';
  });

  container.innerHTML = `
    <div class="empty-state-container animate-fade-in">
      <div class="empty-state-icon">
        <i class="fas fa-warehouse bounce-slow"></i>
      </div>
      <h2 class="empty-state-title">Nenhum Almoxarifado Selecionado</h2>
      <p class="empty-state-text">
        Selecione um almoxarifado no painel de filtros acima para visualizar e auditar o estoque.
      </p>
    </div>
  `;
}

function selecionarAlmox(uf, codigoAlmox) {
  // Reativa tabs
  document.querySelectorAll('#tabsNav .app-tab, .app-tab-mobile').forEach(b => {
    b.disabled = false;
    b.style.opacity = '';
    b.style.pointerEvents = '';
  });

  // Exibe filtros de busca e tipo
  const grupoBusca = document.getElementById('grupoBusca');
  const grupoTipo  = document.getElementById('grupoTipo');
  if (grupoBusca) grupoBusca.style.visibility = 'visible';
  if (grupoTipo)  grupoTipo.style.visibility = 'visible';

  carregarMateriais(uf, codigoAlmox);
  estado.abaAtiva = 'contagem';
  render();
  tentarCarregarRascunho(uf, codigoAlmox);
}

function sincronizarFiltrosApp(uf, codigoAlmox) {
  const selectUf2    = document.getElementById('uf2');
  const selectAlmox2 = document.getElementById('almox2');
  if (!selectUf2 || !selectAlmox2) return;

  popularUFsEm(selectUf2);
  selectUf2.value = uf;

  // Habilita o select do almoxarifado
  selectAlmox2.disabled = false;

  selectAlmox2.innerHTML = '<option value="">Selecione o almoxarifado...</option>';
  if (uf) {
    const almoxs = uf === 'todos' ? obterTodosAlmoxarifados() : getAlmoxarifados(uf);
    almoxs.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.codigo;
      opt.textContent = a.label;
      selectAlmox2.appendChild(opt);
    });
    if (codigoAlmox) selectAlmox2.value = codigoAlmox;
  }
}

// ── Inicialização do App (após carregamento) ───────────────────────────────────

function inicializarApp() {
  if (document.getElementById('appScreen').dataset.iniciado) return;
  document.getElementById('appScreen').dataset.iniciado = '1';

  // Tabs desktop
  document.querySelectorAll('#tabsNav .app-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabsNav .app-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.app-tab-mobile').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      estado.abaAtiva = btn.dataset.tab;
      fecharMenuMobile();
      render();
    });
  });

  // Tabs mobile
  document.querySelectorAll('.app-tab-mobile').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tabsNav .app-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.app-tab-mobile').forEach(b => b.classList.remove('active'));
      const tabDesktop = document.querySelector(`#tabsNav [data-tab="${btn.dataset.tab}"]`);
      if (tabDesktop) tabDesktop.classList.add('active');
      btn.classList.add('active');
      estado.abaAtiva = btn.dataset.tab;
      fecharMenuMobile();
      render();
    });
  });

  // Mobile menu toggle (supporting morphing SVG)
  document.getElementById('btnMenuMobile').addEventListener('click', () => {
    const menu = document.getElementById('mobileMenu');
    const btn  = document.getElementById('btnMenuMobile');
    const svg  = document.getElementById('menuToggleIconSvg');
    const open = menu.style.display !== 'none';
    if (open) {
      fecharMenuMobile();
    } else {
      menu.style.display = 'block';
      btn.setAttribute('aria-expanded', 'true');
      if (svg) svg.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  });

  // Scroll → header blur (header-1 style)
  const header = document.getElementById('mainHeader');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // Get Started (Salvar Contagem) from Header
  const btnSalvarHeader = document.getElementById('btnSalvarHeader');
  if (btnSalvarHeader) {
    btnSalvarHeader.addEventListener('click', abrirModalConfirmacao);
  }
  const btnSalvarMobile = document.getElementById('btnSalvarMobile');
  if (btnSalvarMobile) {
    btnSalvarMobile.addEventListener('click', () => {
      fecharMenuMobile();
      abrirModalConfirmacao();
    });
  }

  // Trocar base (Sign In mapping - if present)
  const btnTrocarBase = document.getElementById('btnTrocarBase');
  if (btnTrocarBase) {
    btnTrocarBase.addEventListener('click', voltarParaLanding);
  }
  const btnTrocarBaseMovil = document.getElementById('btnTrocarBaseMovil');
  if (btnTrocarBaseMovil) {
    btnTrocarBaseMovil.addEventListener('click', () => {
      fecharMenuMobile();
      voltarParaLanding();
    });
  }

  // Busca e filtros
  document.getElementById('searchInput').addEventListener('input', debounce(onBuscaInput, 300));
  document.getElementById('tipoFilter').addEventListener('change', onTipoFilterChange);
  document.getElementById('almox2').addEventListener('change', (e) => {
    const codigoAlmox = e.target.value;
    const selectUf2 = document.getElementById('uf2');
    const uf = selectUf2 ? selectUf2.value : 'todos';
    if (codigoAlmox) {
      selecionarAlmox(uf, codigoAlmox);
    } else {
      renderEstadoVazioSelecao();
    }
  });

  // Event delegation para botões dinâmicos
  document.getElementById('abaConteudo').addEventListener('click', (e) => {
    if (e.target.closest('#btnSalvar'))   { abrirModalConfirmacao(); return; }
    if (e.target.closest('#btnExportar')) { exportarParaExcel();     return; }
  });

  // Modal
  document.getElementById('btnConfirmarSalvar').addEventListener('click', salvarContagens);
  document.getElementById('btnCancelarSalvar').addEventListener('click', fecharModalConfirmacao);

  // Tema
  document.getElementById('btnTema').addEventListener('click', alternarTema);
  document.getElementById('btnTemaMovil').addEventListener('click', () => {
    fecharMenuMobile();
    alternarTema();
  });
}

function voltarParaLanding() {
  const app     = document.getElementById('appScreen');
  const landing = document.getElementById('landingScreen');

  app.style.display = 'none';
  app.dataset.iniciado = '';

  estado.materiais = [];
  estado.materiaisVisiveis = [];
  estado.contagens = {};

  // Reseta o select de UF no landing
  const selectUf = document.getElementById('uf');
  if (selectUf) selectUf.value = '';

  // Reseta o select de Almoxarifado no app
  const selectAlmox2 = document.getElementById('almox2');
  if (selectAlmox2) {
    selectAlmox2.value = '';
    selectAlmox2.disabled = true;
  }

  landing.classList.remove('fade-out');
  landing.style.display = 'flex';

  window.scrollTo({ top: 0 });
  document.body.style.overflow = '';
}

function fecharMenuMobile() {
  const menu = document.getElementById('mobileMenu');
  const btn  = document.getElementById('btnMenuMobile');
  const svg  = document.getElementById('menuToggleIconSvg');
  if (!menu || !btn) return;
  menu.style.display = 'none';
  btn.setAttribute('aria-expanded', 'false');
  if (svg) svg.classList.remove('open');
  document.body.style.overflow = '';
}

function tentarCarregarRascunho(uf, codigoAlmox) {
  const chave = getChaveRascunho(uf, codigoAlmox);
  if (!chave) return;
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo) {
      estado.contagens = JSON.parse(salvo);
      atualizarProgresso();
    }
  } catch (_) { /* ignora */ }
}


// ─── Handlers de Eventos ──────────────────────────────────────────────────────

function onUfChange(e) {
  const uf = e.target.value;
  const selectAlmox = document.getElementById('almox');
  
  limparTabela();

  if (!uf) {
    selectAlmox.innerHTML = '<option value="">Selecione a UF primeiro</option>';
    selectAlmox.disabled = true;
    return;
  }

  const almoxarifados = uf === 'todos' ? obterTodosAlmoxarifados() : getAlmoxarifados(uf);
  selectAlmox.innerHTML = '<option value="">Selecione o almoxarifado...</option>';
  
  const optTodos = document.createElement('option');
  optTodos.value = 'todos';
  optTodos.textContent = 'Todos os almoxarifados';
  selectAlmox.appendChild(optTodos);

  almoxarifados.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.codigo;
    opt.textContent = a.label;
    selectAlmox.appendChild(opt);
  });
  
  selectAlmox.disabled = false;

  if (uf === 'todos') {
    selectAlmox.value = 'todos';
    carregarMateriaisComLoader(uf, 'todos');
  }
}

function onAlmoxChange(e) {
  const codigo = e.target.value;
  if (!codigo) {
    limparTabela();
    return;
  }

  const uf = document.getElementById('uf').value;
  carregarMateriaisComLoader(uf, codigo);
}

function executarFiltros() {
  estado.materiaisVisiveis = filtrarMateriais(
    estado.materiais,
    estado.filtros
  );

  if (estado.colunaOrdenacao) {
    estado.materiaisVisiveis = ordenarPor(
      estado.materiaisVisiveis,
      estado.colunaOrdenacao,
      estado.direcaoOrdenacao
    );
  }

  render();
}

function onBuscaInput(e) {
  estado.filtros.termo = e.target.value;
  executarFiltros();
}

function onTipoFilterChange(e) {
  estado.filtros.tipo = e.target.value;
  executarFiltros();
}

function onOrdenarColuna(coluna) {
  if (!estado.materiaisVisiveis.length) return;

  if (estado.colunaOrdenacao === coluna) {
    estado.direcaoOrdenacao = estado.direcaoOrdenacao === 'asc' ? 'desc' : 'asc';
  } else {
    estado.colunaOrdenacao = coluna;
    estado.direcaoOrdenacao = 'asc';
  }

  estado.materiaisVisiveis = ordenarPor(estado.materiaisVisiveis, coluna, estado.direcaoOrdenacao);
  
  // Atualiza ícones do cabeçalho
  document.querySelectorAll('#abaConteudo th[data-sort] i').forEach(i => i.className = 'fas fa-sort sort-icon');
  const iconeAtivo = document.querySelector(`#abaConteudo th[data-sort="${coluna}"] i`);
  if (iconeAtivo) {
    iconeAtivo.className = estado.direcaoOrdenacao === 'asc' ? 'fas fa-sort-up sort-icon' : 'fas fa-sort-down sort-icon';
  }

  renderizarTabela();
}

// ─── Lógica de Negócio UI ─────────────────────────────────────────────────────

function popularUFsEm(selectEl) {
  const estados = getEstados();
  // Preserva a primeira opção já existente (Selecione...) e adiciona abaixo
  if (!selectEl.querySelector('option[value="todos"]')) {
    const optTodos = document.createElement('option');
    optTodos.value = 'todos';
    optTodos.textContent = 'Todas as bases';
    selectEl.appendChild(optTodos);
  }
  estados.forEach(e => {
    if (!selectEl.querySelector(`option[value="${e.sigla}"]`)) {
      const opt = document.createElement('option');
      opt.value = e.sigla;
      opt.textContent = e.nome;
      selectEl.appendChild(opt);
    }
  });
}


function obterTodosAlmoxarifados() {
  const estados = getEstados();
  return estados.flatMap(e => getAlmoxarifados(e.sigla));
}

function carregarMateriaisComLoader(uf, codigoAlmox) {
  mostrarLoader(true);
  
  setTimeout(() => {
    carregarMateriais(uf, codigoAlmox);
    mostrarLoader(false);
  }, 600);
}

function getChaveRascunho(uf, codigoAlmox) {
  if (!codigoAlmox) return null;
  if (codigoAlmox === 'todos') return `sgi-draft-${uf || 'todos'}-todos`;
  return `sgi-draft-${codigoAlmox}`;
}

function getDescricaoSelecao(uf, codigoAlmox) {
  if (codigoAlmox === 'todos') {
    if (uf === 'todos') return 'de todas as bases e almoxarifados';
    return `de todos os almoxarifados de ${uf}`;
  }

  const almoxarifados = uf === 'todos' ? obterTodosAlmoxarifados() : getAlmoxarifados(uf);
  const label = almoxarifados.find(a => a.codigo === codigoAlmox)?.label || codigoAlmox;
  return `do almoxarifado ${label}`;
}

function carregarMateriais(uf, codigoAlmox) {
  if (codigoAlmox === 'todos') {
    const almoxarifados = uf === 'todos' ? obterTodosAlmoxarifados() : getAlmoxarifados(uf);
    const codigos = almoxarifados.map(a => a.codigo);
    estado.materiais = codigos.flatMap(codigo => getMateriais(codigo));
  } else {
    estado.materiais = getMateriais(codigoAlmox);
  }
  estado.materiaisVisiveis = [...estado.materiais];
  
  // Reset active tab and filters
  estado.abaAtiva = 'contagem';
  estado.filtros.termo = '';
  estado.filtros.tipo = 'todos';
  estado.colunaOrdenacao = null;
  estado.direcaoOrdenacao = 'asc';
  
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  const tipoFilter = document.getElementById('tipoFilter');
  if (tipoFilter) tipoFilter.value = 'todos';

  // Reseta abas ativas visualmente (desktop + mobile)
  document.querySelectorAll('#tabsNav .app-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'contagem');
  });
  document.querySelectorAll('.app-tab-mobile').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === 'contagem');
  });

  // Recupera rascunho salvo do localStorage se houver
  const chaveRascunho = getChaveRascunho(uf, codigoAlmox);
  const rascunhoSalvo = chaveRascunho ? localStorage.getItem(chaveRascunho) : null;
  if (rascunhoSalvo && chaveRascunho) {
    try {
      estado.contagens = JSON.parse(rascunhoSalvo);
      mostrarToast('Rascunho recuperado com sucesso!', 'sucesso');
    } catch (e) {
      console.error("Erro ao carregar rascunho:", e);
      estado.contagens = {};
    }
  } else {
    estado.contagens = {};
  }
  
  limparHistorico();
  abaEstruturaCarregada = null;

  // Toast de confirmação
  mostrarToast(`Carregados ${estado.materiais.length} itens ${getDescricaoSelecao(uf, codigoAlmox)}`, 'info');
}

function limparTabela() {
  estado.materiais = [];
  estado.materiaisVisiveis = [];
  estado.contagens = {};
  estado.filtros.termo = '';
  estado.filtros.tipo = 'todos';
  estado.colunaOrdenacao = null;
  estado.direcaoOrdenacao = 'asc';
  if (document.getElementById('abaConteudo')) {
    document.getElementById('abaConteudo').innerHTML = '';
  }
  abaEstruturaCarregada = null;
}

function registrarDigitacao(id, novaQtd, observacao) {
  if (novaQtd === '' || novaQtd === null) {
    delete estado.contagens[id];
  } else {
    estado.contagens[id] = { 
      novaQtd: Number(novaQtd), 
      observacao: observacao || '' 
    };
  }
  
  // Salva rascunho — usa os selects do app (uf2/almox2)
  const uf    = document.getElementById('uf2')?.value   || document.getElementById('uf')?.value;
  const almox = document.getElementById('almox2')?.value || document.getElementById('almox')?.value;
  const chaveRascunho = getChaveRascunho(uf, almox);
  if (chaveRascunho) {
    localStorage.setItem(chaveRascunho, JSON.stringify(estado.contagens));
  }
  
  atualizarProgresso();
}

function atualizarDivergenciaRow(id, value) {
  const tr = document.querySelector(`#abaConteudo tr[data-id="${id}"]`);
  if (!tr) return;
  
  const m = estado.materiais.find(item => item.id === id);
  if (!m) return;
  
  const desvioCell = tr.querySelector('.desvio-cell');
  if (!desvioCell) return;
  
  if (value === '' || value === null) {
    desvioCell.innerHTML = '<span class="badge-diff igual">—</span>';
    tr.classList.remove('linha-editada');
  } else {
    const val = Number(value);
    const desvio = val - m.saldoAtual;
    tr.classList.add('linha-editada');
    
    if (desvio === 0) {
      desvioCell.innerHTML = '<span class="badge-diff igual"><i class="fas fa-check"></i> ✓</span>';
    } else if (desvio > 0) {
      desvioCell.innerHTML = `<span class="badge-diff sobra">+${desvio}</span>`;
    } else {
      desvioCell.innerHTML = `<span class="badge-diff falta">${desvio}</span>`;
    }
  }
}

function atualizarKpisReativos() {
  const stats = calcularAcuracidade(estado.materiais, estado.contagens);
  
  const cardAcuracidade = document.querySelector('.kpi-acuracidade .stat-number');
  if (cardAcuracidade) {
    cardAcuracidade.textContent = `${stats.taxaAcuracidade}%`;
  }
  
  const cardContados = document.querySelector('.kpi-contados .stat-number');
  if (cardContados) {
    cardContados.textContent = `${stats.contados}`;
  }
  
  const cardDivergentes = document.querySelector('.kpi-divergentes .stat-number');
  if (cardDivergentes) {
    cardDivergentes.textContent = `${stats.divergentes}`;
  }
}

function renderizarTabela() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  if (estado.materiaisVisiveis.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">Nenhum material encontrado.</td></tr>';
    return;
  }

  estado.materiaisVisiveis.forEach(m => {
    const contagemAtual = estado.contagens[m.id];
    const valorInput = contagemAtual ? contagemAtual.novaQtd : '';
    const obsInput = contagemAtual ? contagemAtual.observacao : '';
    const isEditado = contagemAtual !== undefined;

    const tr = document.createElement('tr');
    tr.dataset.id = m.id;
    if (isEditado) tr.classList.add('linha-editada');

    const badgeClass = getBadgeClass(m.saldoAtual);
    const dataFmt = formatarData(m.ultimaAtualizacao);
    
    let desvioHtml = '<span class="badge-diff igual">—</span>';
    if (isEditado) {
      const desvioVal = contagemAtual.novaQtd - m.saldoAtual;
      if (desvioVal === 0) {
        desvioHtml = '<span class="badge-diff igual"><i class="fas fa-check"></i> ✓</span>';
      } else if (desvioVal > 0) {
        desvioHtml = `<span class="badge-diff sobra">+${desvioVal}</span>`;
      } else {
        desvioHtml = `<span class="badge-diff falta">${desvioVal}</span>`;
      }
    }

    tr.innerHTML = `
      <td><strong>${sanitizarTexto(m.origem)}</strong></td>
      <td title="${sanitizarTexto(m.descricao)}">${truncarTexto(m.descricao, 35)}</td>
      <td><span class="badge-unidade">${sanitizarTexto(m.unidade)}</span></td>
      <td><span class="badge ${badgeClass}">${m.saldoAtual}</span></td>
      <td class="desvio-cell">${desvioHtml}</td>
      <td><span class="data-badge">${dataFmt}</span></td>
      <td>
        <input type="number" class="qty-input" min="0" placeholder="0" value="${valorInput}">
      </td>
      <td>
        <div class="obs-container">
          <input type="text" class="obs-input" placeholder="Comentário..." value="${sanitizarTexto(obsInput)}" maxlength="500">
        </div>
      </td>
    `;

    const inputQtd = tr.querySelector('.qty-input');
    const inputObs = tr.querySelector('.obs-input');

    const atualizaEstado = () => registrarDigitacao(m.id, inputQtd.value, inputObs.value);
    
    inputQtd.addEventListener('input', () => {
      atualizaEstado();
      atualizarDivergenciaRow(m.id, inputQtd.value);
      atualizarKpisReativos();
    });
    
    inputObs.addEventListener('input', atualizaEstado);

    tbody.appendChild(tr);
  });
}

function atualizarProgresso() {
  const prog = calcularProgresso(estado.materiais, estado.contagens);
  
  const texto = document.getElementById('progressoTexto');
  if (texto) texto.textContent = `${prog.contados} de ${prog.total} itens contados`;
  
  const barra = document.getElementById('progressoBarra');
  if (barra) barra.style.width = `${prog.percentual}%`;
  
  const btnSalvar = document.getElementById('btnSalvar');
  if (btnSalvar) btnSalvar.disabled = prog.contados === 0;
}

// ─── Roteamento de Renderização por Abas ──────────────────────────────────────

function render() {
  const container = document.getElementById('abaConteudo');
  if (!container) return;

  if (estado.abaAtiva === 'contagem') {
    if (abaEstruturaCarregada !== 'contagem') {
      container.innerHTML = obterEstruturaContagemHtml();
      abaEstruturaCarregada = 'contagem';
      
      // Vincula cliques de ordenação nos cabeçalhos
      document.querySelectorAll('#abaConteudo th[data-sort]').forEach(th => {
        th.addEventListener('click', () => onOrdenarColuna(th.dataset.sort));
      });
    }
    
    document.getElementById('grupoBusca').style.visibility = 'visible';
    document.getElementById('grupoTipo').style.visibility = 'visible';
    
    atualizarKpisReativos();
    atualizarProgresso();
    renderizarTabela();
    
  } else {
    document.getElementById('grupoBusca').style.visibility = 'visible';
    document.getElementById('grupoTipo').style.visibility = 'visible';
    
    abaEstruturaCarregada = estado.abaAtiva;

    if (estado.abaAtiva === 'curvaABC') {
      renderAbaCurvaABC(container);
    } else if (estado.abaAtiva === 'monitoramento') {
      renderAbaMonitoramento(container);
    }
  }
}

function obterEstruturaContagemHtml() {
  return `
    <div class="stats-container animate-fade-in">
      <div class="stat-card kpi-acuracidade">
        <div class="stat-label"><i class="fas fa-bullseye"></i> Acuracidade Física</div>
        <div class="stat-number">100%</div>
        <div class="stat-desc">Percentual de acertos dos itens contados</div>
      </div>
      <div class="stat-card kpi-contados">
        <div class="stat-label"><i class="fas fa-check-double"></i> Itens Auditados</div>
        <div class="stat-number">0</div>
        <div class="stat-desc">Aguardando contagem física</div>
      </div>
      <div class="stat-card kpi-divergentes">
        <div class="stat-label"><i class="fas fa-exclamation-circle"></i> Itens Divergentes</div>
        <div class="stat-number">0</div>
        <div class="stat-desc">Contagens físicas divergentes</div>
      </div>
    </div>
    
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th data-sort="origem"><i class="fas fa-sort"></i> Origem</th>
            <th data-sort="descricao"><i class="fas fa-sort"></i> Descrição</th>
            <th data-sort="unidade"><i class="fas fa-sort"></i> UN</th>
            <th data-sort="saldoAtual"><i class="fas fa-sort"></i> Saldo Sistema</th>
            <th>Desvio</th>
            <th data-sort="ultimaAtualizacao"><i class="fas fa-sort"></i> Última Atualização</th>
            <th>Contagem Física</th>
            <th>Observação / Comentário</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          <!-- Células geradas via loop seguro -->
        </tbody>
      </table>
    </div>

    <div class="actions-bar">
      <div class="progress-container">
        <div class="progress-header">
          <span id="progressoTexto">0 de 0 itens contados</span>
        </div>
        <div class="progress-track">
          <div id="progressoBarra" class="progress-fill"></div>
        </div>
      </div>
      
      <div class="buttons-group">
        <button id="btnExportar" class="btn btn-secondary btn-excel">
          <i class="fas fa-file-excel"></i> Exportar
        </button>
        <button id="btnSalvar" class="btn btn-primary" disabled>
          <i class="fas fa-save"></i> Gravar Contagem
        </button>
      </div>
    </div>
  `;
}

function renderAbaCurvaABC(container) {
  const abc = classificarCurvaABC(estado.materiaisVisiveis, estado.contagens);
  const totalItens = estado.materiaisVisiveis.length;
  
  const totalA = abc.classes.A.length;
  const totalB = abc.classes.B.length;
  const totalC = abc.classes.C.length;
  
  const pctA = totalItens > 0 ? Math.round((totalA / totalItens) * 100) : 0;
  const pctB = totalItens > 0 ? Math.round((totalB / totalItens) * 100) : 0;
  const pctC = totalItens > 0 ? Math.round((totalC / totalItens) * 100) : 0;
  
  const valorA = abc.classes.A.reduce((sum, i) => sum + i.valorEstoque, 0);
  const valorB = abc.classes.B.reduce((sum, i) => sum + i.valorEstoque, 0);
  const valorC = abc.classes.C.reduce((sum, i) => sum + i.valorEstoque, 0);
  
  const pctValA = abc.valorTotalEstoque > 0 ? Math.round((valorA / abc.valorTotalEstoque) * 100) : 0;
  const pctValB = abc.valorTotalEstoque > 0 ? Math.round((valorB / abc.valorTotalEstoque) * 100) : 0;
  const pctValC = abc.valorTotalEstoque > 0 ? Math.round((valorC / abc.valorTotalEstoque) * 100) : 0;

  const todosItensAbc = [];
  abc.classes.A.forEach(i => todosItensAbc.push({ ...i, classe: 'A' }));
  abc.classes.B.forEach(i => todosItensAbc.push({ ...i, classe: 'B' }));
  abc.classes.C.forEach(i => todosItensAbc.push({ ...i, classe: 'C' }));
  
  todosItensAbc.sort((a, b) => b.valorEstoque - a.valorEstoque);

  container.innerHTML = `
    <div class="stats-container animate-fade-in">
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-boxes"></i> Valor Total em Estoque</div>
        <div class="stat-number">${formatarMoeda(abc.valorTotalEstoque)}</div>
        <div class="stat-desc">Valoração total dos ativos deste almoxarifado</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-percentage"></i> Acuracidade Geral</div>
        <div class="stat-number">
          ${calcularAcuracidade(estado.materiaisVisiveis, estado.contagens).taxaAcuracidade}%
        </div>
        <div class="stat-desc">Média ponderada física da contagem</div>
      </div>
    </div>

    <div class="curva-grid animate-fade-in">
      <div class="curva-box classe-A">
        <div class="curva-header">
          <div class="curva-title">Classe A</div>
          <div class="curva-val">Alta Relevância</div>
        </div>
        <div class="curva-stat">
          <span>Itens Cadastrados</span>
          <span>${totalA} itens (${pctA}%)</span>
        </div>
        <div class="curva-stat">
          <span>Valor em Estoque</span>
          <span>${formatarMoeda(valorA)} (${pctValA}%)</span>
        </div>
        <div class="curva-stat">
          <span>Acuracidade Física</span>
          <span style="color: ${abc.acuracidadePorClasse.A < 100 ? 'var(--warning)' : 'var(--success)'}">
            ${abc.acuracidadePorClasse.A}%
          </span>
        </div>
      </div>

      <div class="curva-box classe-B">
        <div class="curva-header">
          <div class="curva-title">Classe B</div>
          <div class="curva-val">Média Relevância</div>
        </div>
        <div class="curva-stat">
          <span>Itens Cadastrados</span>
          <span>${totalB} itens (${pctB}%)</span>
        </div>
        <div class="curva-stat">
          <span>Valor em Estoque</span>
          <span>${formatarMoeda(valorB)} (${pctValB}%)</span>
        </div>
        <div class="curva-stat">
          <span>Acuracidade Física</span>
          <span style="color: ${abc.acuracidadePorClasse.B < 100 ? 'var(--warning)' : 'var(--success)'}">
            ${abc.acuracidadePorClasse.B}%
          </span>
        </div>
      </div>

      <div class="curva-box classe-C">
        <div class="curva-header">
          <div class="curva-title">Classe C</div>
          <div class="curva-val">Baixa Relevância</div>
        </div>
        <div class="curva-stat">
          <span>Itens Cadastrados</span>
          <span>${totalC} itens (${pctC}%)</span>
        </div>
        <div class="curva-stat">
          <span>Valor em Estoque</span>
          <span>${formatarMoeda(valorC)} (${pctValC}%)</span>
        </div>
        <div class="curva-stat">
          <span>Acuracidade Física</span>
          <span style="color: ${abc.acuracidadePorClasse.C < 100 ? 'var(--warning)' : 'var(--success)'}">
            ${abc.acuracidadePorClasse.C}%
          </span>
        </div>
      </div>
    </div>

    <div class="card animate-fade-in" style="margin-top: 2rem;">
      <h3 style="font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.15rem; margin-bottom: 1rem;">
         <i class="fas fa-list"></i> Detalhes dos Itens Ordenados por Valor Patrimonial
      </h3>
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Classe</th>
              <th>Descrição do Item</th>
              <th>Saldo Sistema</th>
              <th>Preço Unitário</th>
              <th>Valor Patrimonial</th>
            </tr>
          </thead>
          <tbody>
            ${todosItensAbc.map(item => {
              let classBadge = '';
              if (item.classe === 'A') classBadge = '<span class="badge" style="background: var(--text-main); color: var(--bg-body)">Classe A</span>';
              else if (item.classe === 'B') classBadge = '<span class="badge" style="background: var(--text-muted); color: #ffffff">Classe B</span>';
              else classBadge = '<span class="badge" style="background: var(--border-color); color: var(--text-main)">Classe C</span>';

              return `
                <tr>
                  <td>${classBadge}</td>
                  <td><strong>${sanitizarTexto(item.descricao)}</strong></td>
                  <td><span class="badge ${getBadgeClass(item.saldoAtual)}">${item.saldoAtual}</span></td>
                  <td>${formatarMoeda(item.precoUnitario)}</td>
                  <td style="font-weight: 600;">${formatarMoeda(item.valorEstoque)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAbaMonitoramento(container) {
  const materiaisFiltrados = estado.materiaisVisiveis;
  const contagens = estado.contagens;
  
  // 1. KPIs
  const totalItens = materiaisFiltrados.length;
  const valorTotalEstoque = materiaisFiltrados.reduce((acc, m) => acc + (m.saldoAtual * (m.precoUnitario || 0)), 0);
  
  const acuracidadeStats = calcularAcuracidade(materiaisFiltrados, contagens);
  const totalDivergentes = acuracidadeStats.divergentes;
  const taxaAcuracidade = acuracidadeStats.taxaAcuracidade;
  
  const financeiroDivergencias = calcularFinanceiroDivergencias(materiaisFiltrados, contagens);
  const resultadoLiquido = financeiroDivergencias.resultadoLiquido;

  // 2. Classificação ABC para o Gráfico ABC
  const abc = classificarCurvaABC(materiaisFiltrados, contagens);
  const valorA = abc.classes.A.reduce((sum, i) => sum + i.valorEstoque, 0);
  const valorB = abc.classes.B.reduce((sum, i) => sum + i.valorEstoque, 0);
  const valorC = abc.classes.C.reduce((sum, i) => sum + i.valorEstoque, 0);
  
  // 3. Status de Saldo
  const totalDisponivel = materiaisFiltrados.filter(m => m.saldoAtual > 0).length;
  const totalZerado = materiaisFiltrados.filter(m => m.saldoAtual === 0).length;

  // 4. SVG Gauge de Acuracidade
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // 251.32
  const dashoffset = circumference - (taxaAcuracidade / 100) * circumference;

  // 5. Top 5 Mais Valiosos
  const itensComValor = materiaisFiltrados.map(m => ({
    ...m,
    valorEstoque: m.saldoAtual * (m.precoUnitario || 0)
  }));
  itensComValor.sort((a, b) => b.valorEstoque - a.valorEstoque);
  const top5 = itensComValor.slice(0, 5);

  // 6. Divergências Ativas (Itens na contagem que divergem do sistema)
  const divergenciasAtivas = [];
  materiaisFiltrados.forEach(m => {
    if (m.id in contagens) {
      const novaQtd = contagens[m.id].novaQtd;
      if (novaQtd !== m.saldoAtual) {
        const desvio = novaQtd - m.saldoAtual;
        const impacto = desvio * (m.precoUnitario || 0);
        divergenciasAtivas.push({
          descricao: m.descricao,
          saldoAtual: m.saldoAtual,
          novaQtd,
          desvio,
          impacto
        });
      }
    }
  });

  // SVG de Barras para as Classes ABC
  const maxValor = Math.max(valorA, valorB, valorC, 1);
  const pctBarA = Math.round((valorA / maxValor) * 100);
  const pctBarB = Math.round((valorB / maxValor) * 100);
  const pctBarC = Math.round((valorC / maxValor) * 100);

  // SVG de Rosca / Status do Estoque
  const pctDisponivel = totalItens > 0 ? Math.round((totalDisponivel / totalItens) * 100) : 0;
  const pctZerado = totalItens > 0 ? Math.round((totalZerado / totalItens) * 100) : 0;

  // Construindo o HTML do Dashboard
  container.innerHTML = `
    <div class="stats-container animate-fade-in">
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-boxes"></i> Patrimônio Total</div>
        <div class="stat-number">${formatarMoeda(valorTotalEstoque)}</div>
        <div class="stat-desc">Valoração total sob gestão</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-barcode"></i> Volume de Itens</div>
        <div class="stat-number">${totalItens}</div>
        <div class="stat-desc">Materiais selecionados</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-exclamation-triangle"></i> Diferenças</div>
        <div class="stat-number" style="color: ${totalDivergentes > 0 ? 'var(--warning)' : 'var(--text-main)'}">
          ${totalDivergentes}
        </div>
        <div class="stat-desc">Contagens com divergência física</div>
      </div>
      <div class="stat-card">
        <div class="stat-label"><i class="fas fa-coins"></i> Impacto Líquido</div>
        <div class="stat-number" style="color: ${resultadoLiquido < 0 ? 'var(--danger)' : resultadoLiquido > 0 ? 'var(--success)' : 'var(--text-main)'}">
          ${formatarMoeda(resultadoLiquido)}
        </div>
        <div class="stat-desc">Saldo financeiro das divergências</div>
      </div>
    </div>

    <div class="dashboard-grid animate-fade-in">
      <!-- Gráfico 1: Acuracidade Física (Circular Gauge) -->
      <div class="chart-card">
        <div class="chart-card-title">
          <i class="fas fa-bullseye"></i> Acuracidade das Auditorias
        </div>
        <div class="chart-container">
          <svg class="svg-chart" width="160" height="160" viewBox="0 0 100 100">
            <circle class="svg-gauge-bg" cx="50" cy="50" r="40" stroke-width="8"></circle>
            <circle class="svg-gauge-fill" cx="50" cy="50" r="40" stroke-width="8"
                    stroke-dasharray="${circumference}" stroke-dashoffset="${dashoffset}"
                    transform="rotate(-90 50 50)"></circle>
            <text class="svg-gauge-text" x="50" y="52" font-size="14" text-anchor="middle">
              ${taxaAcuracidade}%
            </text>
            <text class="svg-gauge-label" x="50" y="65" text-anchor="middle">ACURÁCIA</text>
          </svg>
        </div>
        <div style="text-align: center; font-size: 0.75rem; color: var(--text-muted);">
          Com base em <strong>${acuracidadeStats.contados}</strong> itens auditados neste filtro.
        </div>
      </div>

      <!-- Gráfico 2: Distribuição Curva ABC (Valoração) -->
      <div class="chart-card">
        <div class="chart-card-title">
          <i class="fas fa-chart-pie"></i> Valor Estocado por Classe
        </div>
        <div class="chart-container" style="flex-direction: column; justify-content: space-around; gap: 0.75rem; padding: 1rem 0;">
          <!-- Barra A -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600;">
              <span>Classe A (Alta Relevância)</span>
              <span>${formatarMoeda(valorA)}</span>
            </div>
            <div class="progress-track" style="height: 10px;">
              <div class="svg-bar-fill-A" style="width: ${pctBarA}%; height: 100%; border-radius: 4px;"></div>
            </div>
          </div>
          <!-- Barra B -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600;">
              <span>Classe B (Média Relevância)</span>
              <span>${formatarMoeda(valorB)}</span>
            </div>
            <div class="progress-track" style="height: 10px;">
              <div class="svg-bar-fill-B" style="width: ${pctBarB}%; height: 100%; border-radius: 4px;"></div>
            </div>
          </div>
          <!-- Barra C -->
          <div style="width: 100%; display: flex; flex-direction: column; gap: 0.25rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 600;">
              <span>Classe C (Baixa Relevância)</span>
              <span>${formatarMoeda(valorC)}</span>
            </div>
            <div class="progress-track" style="height: 10px;">
              <div class="svg-bar-fill-C" style="width: ${pctBarC}%; height: 100%; border-radius: 4px;"></div>
            </div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot legend-a"></span>Classe A</span>
          <span class="legend-item"><span class="legend-dot legend-b"></span>Classe B</span>
          <span class="legend-item"><span class="legend-dot legend-c"></span>Classe C</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">
          Valores calculados sobre os materiais visíveis.
        </div>
      </div>

      <!-- Gráfico 3: Status do Estoque (Disponibilidade) -->
      <div class="chart-card">
        <div class="chart-card-title">
          <i class="fas fa-boxes-packing"></i> Nível de Disponibilidade
        </div>
        <div class="chart-container" style="flex-direction: column; justify-content: center; gap: 1.5rem;">
          <div style="display: flex; align-items: center; width: 100%; gap: 1rem;">
            <i class="fas fa-box" style="font-size: 1.5rem; color: var(--text-main);"></i>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;">
                <span>Disponível (>0)</span>
                <span>${totalDisponivel} itens (${pctDisponivel}%)</span>
              </div>
              <div class="progress-track" style="height: 6px; margin-top: 0.25rem;">
                <div style="background: var(--chart-available); width: ${pctDisponivel}%; height: 100%;"></div>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; width: 100%; gap: 1rem;">
            <i class="fas fa-box-open" style="font-size: 1.5rem; color: var(--text-muted);"></i>
            <div style="flex: 1;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 600;">
                <span>Estoque Zerado (=0)</span>
                <span>${totalZerado} itens (${pctZerado}%)</span>
              </div>
              <div class="progress-track" style="height: 6px; margin-top: 0.25rem;">
                <div style="background: var(--chart-zero); width: ${pctZerado}%; height: 100%; border: 1px solid var(--glass-border);"></div>
              </div>
            </div>
          </div>
        </div>
        <div class="chart-legend">
          <span class="legend-item"><span class="legend-dot legend-available"></span>Disponível</span>
          <span class="legend-item"><span class="legend-dot legend-zero"></span>Zerado</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">
          Status dos itens carregados no painel.
        </div>
      </div>
    </div>

    <!-- Seção de Tabelas Analíticas -->
    <div class="dashboard-grid animate-fade-in" style="grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));">
      <!-- Tabela 1: Top 5 Itens Mais Valiosos -->
      <div class="mini-table-card">
        <h3 class="chart-card-title" style="border-bottom: 1px solid var(--border-color);"><i class="fas fa-award"></i> Top 5 Ativos de Maior Valor</h3>
        <table class="mini-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Saldo</th>
              <th>Preço Unit.</th>
              <th>Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${top5.length === 0 ? `
              <tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Sem materiais no filtro.</td></tr>
            ` : top5.map(item => `
              <tr>
                <td class="mini-table-desc" title="${sanitizarTexto(item.descricao)}"><strong>${sanitizarTexto(item.descricao)}</strong></td>
                <td><span class="badge-unidade">${item.saldoAtual} ${sanitizarTexto(item.unidade)}</span></td>
                <td>${formatarMoeda(item.precoUnitario)}</td>
                <td style="font-weight: 600;">${formatarMoeda(item.valorEstoque)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Tabela 2: Divergências Ativas -->
      <div class="mini-table-card">
        <h3 class="chart-card-title" style="border-bottom: 1px solid var(--border-color);"><i class="fas fa-triangle-exclamation"></i> Divergências na Contagem</h3>
        <table class="mini-table">
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Sistema</th>
              <th>Físico</th>
              <th>Desvio</th>
              <th>Impacto R$</th>
            </tr>
          </thead>
          <tbody>
            ${divergenciasAtivas.length === 0 ? `
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">Nenhuma divergência registrada.</td></tr>
            ` : divergenciasAtivas.map(item => {
              const badgeClass = item.desvio > 0 ? 'badge-diff sobra' : 'badge-diff falta';
              const textSign = item.desvio > 0 ? '+' : '';
              return `
                <tr>
                  <td class="mini-table-desc" title="${sanitizarTexto(item.descricao)}"><strong>${sanitizarTexto(item.descricao)}</strong></td>
                  <td>${item.saldoAtual}</td>
                  <td>${item.novaQtd}</td>
                  <td><span class="${badgeClass}">${textSign}${item.desvio}</span></td>
                  <td style="font-weight: 600; color: ${item.impacto < 0 ? 'var(--danger)' : 'var(--success)'}">
                    ${formatarMoeda(item.impacto)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
    </div>
  `;
}

// ─── Ações de Salvar e Modal ──────────────────────────────────────────────────

function abrirModalConfirmacao() {
  const arrContagens = Object.keys(estado.contagens).map(id => ({
    id,
    novaQtd: estado.contagens[id].novaQtd
  }));

  const validacao = validarContagens(arrContagens);
  if (!validacao.valido) {
    mostrarToast(validacao.erro, 'erro');
    return;
  }

  document.getElementById('modalResumoTotal').textContent = arrContagens.length;
  
  let divergencias = 0;
  arrContagens.forEach(c => {
    const mat = estado.materiais.find(m => m.id === c.id);
    if (mat && mat.saldoAtual !== c.novaQtd) {
      divergencias++;
    }
  });
  
  document.getElementById('modalResumoDivergencias').textContent = divergencias;
  document.getElementById('modalOverlay').style.display = 'flex';
}

function fecharModalConfirmacao() {
  document.getElementById('modalOverlay').style.display = 'none';
}

function salvarContagens() {
  fecharModalConfirmacao();
  
  const arrContagens = Object.keys(estado.contagens).map(id => ({
    id,
    novaQtd: estado.contagens[id].novaQtd,
    observacao: estado.contagens[id].observacao
  }));

  try {
    arrContagens.forEach(c => {
      const mat = estado.materiais.find(m => m.id === c.id);
      adicionarRegistro({
        id: c.id,
        descricao: mat ? mat.descricao : '',
        valorAnterior: mat ? mat.saldoAtual : null,
        valorNovo: c.novaQtd,
        observacao: c.observacao
      });
      
      if (mat) {
        mat.saldoAtual = c.novaQtd;
        mat.ultimaAtualizacao = new Date().toISOString();
      }
    });

    estado.contagens = {};
    
    const uf = document.getElementById('uf').value;
    const almox = document.getElementById('almox').value;
    const chaveRascunho = getChaveRascunho(uf, almox);
    if (chaveRascunho) {
      localStorage.removeItem(chaveRascunho);
    }

    atualizarProgresso();
    render();
    
    mostrarToast('Contagem salva com sucesso! Saldos atualizados.', 'sucesso');
    
  } catch (err) {
    mostrarToast('Erro ao salvar: ' + err.message, 'erro');
  }
}

// ─── Exportação ───────────────────────────────────────────────────────────────

function exportarParaExcel() {
  if (estado.materiais.length === 0) {
    mostrarToast('Nenhum dado para exportar.', 'aviso');
    return;
  }

  try {
    const arrContagens = Object.keys(estado.contagens).map(id => ({
      id,
      novaQtd: estado.contagens[id].novaQtd,
      observacao: estado.contagens[id].observacao
    }));

    const dados = prepararDadosExport(estado.materiais, arrContagens);
    
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    
    const almox = document.getElementById('almox').value;
    const nomeArquivo = gerarNomeArquivo(almox);
    
    XLSX.writeFile(wb, nomeArquivo);
    mostrarToast('Relatório Excel gerado com sucesso!', 'sucesso');
    
  } catch (error) {
    mostrarToast('Erro ao gerar Excel: ' + error.message, 'erro');
  }
}

// ─── UI Utilities (DOM) ───────────────────────────────────────────────────────

function mostrarLoader(show) {
  document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

function mostrarToast(mensagem, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let icone = 'fa-info-circle';
  if (tipo === 'sucesso') icone = 'fa-check-circle';
  if (tipo === 'erro') icone = 'fa-times-circle';
  if (tipo === 'aviso') icone = 'fa-exclamation-triangle';

  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<i class="fas ${icone}"></i> <span>${sanitizarTexto(mensagem)}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.style.opacity = '1', 10);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Tema Escuro ──────────────────────────────────────────────────────────────

function alternarTema() {
  const isEscuro = document.documentElement.getAttribute('data-tema') === 'escuro';
  const novoTema = isEscuro ? 'claro' : 'escuro';
  
  document.documentElement.setAttribute('data-tema', novoTema);
  localStorage.setItem('sgi-tema', novoTema);
  
  atualizarIconeTema(novoTema);
}

function aplicarTema() {
  const temaSalvo = localStorage.getItem('sgi-tema') || 'claro';
  document.documentElement.setAttribute('data-tema', temaSalvo);
  atualizarIconeTema(temaSalvo);
}

function atualizarIconeTema(tema) {
  const icon = document.querySelector('#btnTema i');
  if (tema === 'escuro') {
    icon.className = 'fas fa-sun';
  } else {
    icon.className = 'fas fa-moon';
  }
}

