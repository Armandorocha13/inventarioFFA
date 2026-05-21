/**
 * dadosMock.js — Fonte de dados mockados do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Simula a estrutura de dados que futuramente virá do Google Sheets via API.
 * Centraliza TODOS os dados da aplicação num único lugar para facilitar
 * a migração para um backend real.
 *
 * Exporta:
 *   - getEstados()           → lista de estados (sigla + nome)
 *   - getTodasUFs()          → apenas as siglas dos estados
 *   - getAlmoxarifados(uf)   → almoxarifados de um estado
 *   - getMateriais(codigo)   → materiais de um almoxarifado
 */

// ─── Tabela de Estados ────────────────────────────────────────────────────────
// Cada estado tem uma sigla (usada como chave interna) e um nome de exibição

const ESTADOS = [
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'ES', nome: 'Espírito Santo' },
];

// ─── Almoxarifados por UF ─────────────────────────────────────────────────────
// Mapa: sigla do estado → lista de almoxarifados
// Cada almoxarifado tem:
//   codigo: chave usada nas requisições e filtros
//   label:  texto de exibição no select

const ALMOXARIFADOS = {
  RJ: [
    { codigo: 'RJO', label: 'RJO — Rio de Janeiro (Central)' },
    { codigo: 'VRD', label: 'VRD — Volta Redonda' },
    { codigo: 'CPS', label: 'CPS — Campos dos Goytacazes' },
    { codigo: 'ROS', label: 'ROS — Resende' },
  ],
  ES: [
    { codigo: 'VVA', label: 'VVA — Vila Velha' },
    { codigo: 'CIM', label: 'CIM — Cariacica Industrial' },
    { codigo: 'CNA', label: 'CNA — Cachoeiro de Itapemirim' },
    { codigo: 'LNS', label: 'LNS — Linhares' },
  ],
};

// ─── Materiais por Almoxarifado ───────────────────────────────────────────────
// Mapa: codigo do almoxarifado → lista de materiais
// Cada material segue o schema:
//   id               → identificador único (formato: "CODIGO-SEQ")
//   origem           → código do almoxarifado
//   descricao        → nome do material em caixa alta
//   unidade          → unidade de medida (M, UN, PC, RL, VR, PAR...)
//   saldoAtual       → quantidade no sistema (número inteiro ≥ 0)
//   ultimaAtualizacao → data da última contagem (string ISO "YYYY-MM-DD") ou null

const MATERIAIS = {
  // ── RJO: Rio de Janeiro Central ──────────────────────────────────────────
  RJO: [
    { id: 'RJO-001', origem: 'RJO', descricao: 'CABO DE FORÇA 10MM', unidade: 'M', saldoAtual: 350, ultimaAtualizacao: '2025-04-10', precoUnitario: 28.50 },
    { id: 'RJO-002', origem: 'RJO', descricao: 'PARAFUSO SEXTAVADO M8 × 25', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-03-22', precoUnitario: 1.20 },
    { id: 'RJO-003', origem: 'RJO', descricao: 'LUVA DE COMPRESSÃO 50MM', unidade: 'PC', saldoAtual: 8, ultimaAtualizacao: '2025-02-14', precoUnitario: 12.80 },
    { id: 'RJO-004', origem: 'RJO', descricao: 'FITA ISOLANTE PRETA 19MM × 20M', unidade: 'RL', saldoAtual: 120, ultimaAtualizacao: '2025-01-30', precoUnitario: 9.50 },
    { id: 'RJO-005', origem: 'RJO', descricao: 'DISJUNTOR TRIPOLAR 100A', unidade: 'UN', saldoAtual: 5, ultimaAtualizacao: null, precoUnitario: 245.00 },
    { id: 'RJO-006', origem: 'RJO', descricao: 'TERMINAL OLHAL 70MM²', unidade: 'PC', saldoAtual: 200, ultimaAtualizacao: '2025-05-01', precoUnitario: 4.50 },
    { id: 'RJO-007', origem: 'RJO', descricao: 'CABO PP 3 × 2,5MM', unidade: 'M', saldoAtual: 0, ultimaAtualizacao: '2025-04-28', precoUnitario: 18.90 },
    { id: 'RJO-008', origem: 'RJO', descricao: 'ELETRODUTO RÍGIDO 3/4"', unidade: 'VR', saldoAtual: 60, ultimaAtualizacao: '2025-03-15', precoUnitario: 32.00 },
  ],

  // ── VRD: Volta Redonda ────────────────────────────────────────────────────
  VRD: [
    { id: 'VRD-001', origem: 'VRD', descricao: 'TRANSFORMADOR 15KVA 220/380V', unidade: 'UN', saldoAtual: 2, ultimaAtualizacao: '2025-04-05', precoUnitario: 6800.00 },
    { id: 'VRD-002', origem: 'VRD', descricao: 'CABO ALUMÍNIO 35MM² XLPE', unidade: 'M', saldoAtual: 1200, ultimaAtualizacao: '2025-03-18', precoUnitario: 14.50 },
    { id: 'VRD-003', origem: 'VRD', descricao: 'POSTE DE CONCRETO 9M 300DAN', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-02-20', precoUnitario: 850.00 },
    { id: 'VRD-004', origem: 'VRD', descricao: 'CHAVE FUSÍVEL 15KV 100A', unidade: 'UN', saldoAtual: 10, ultimaAtualizacao: '2025-01-10', precoUnitario: 420.00 },
    { id: 'VRD-005', origem: 'VRD', descricao: 'ISOLADOR PINO 15KV', unidade: 'UN', saldoAtual: 45, ultimaAtualizacao: null, precoUnitario: 85.00 },
    { id: 'VRD-006', origem: 'VRD', descricao: 'CRUZETA DE MADEIRA 2,20M', unidade: 'UN', saldoAtual: 30, ultimaAtualizacao: '2025-05-02', precoUnitario: 160.00 },
  ],

  // ── CPS: Campos dos Goytacazes ────────────────────────────────────────────
  CPS: [
    { id: 'CPS-001', origem: 'CPS', descricao: 'MEDIDOR MONOFÁSICO ELETRÔNICO', unidade: 'UN', saldoAtual: 15, ultimaAtualizacao: '2025-04-20', precoUnitario: 185.00 },
    { id: 'CPS-002', origem: 'CPS', descricao: 'CAIXA DE MEDIÇÃO PADRÃO', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-03-30', precoUnitario: 95.00 },
    { id: 'CPS-003', origem: 'CPS', descricao: 'CABO MULTIPLEX 4 × 16MM²', unidade: 'M', saldoAtual: 500, ultimaAtualizacao: '2025-02-28', precoUnitario: 22.40 },
    { id: 'CPS-004', origem: 'CPS', descricao: 'RELÉ DE PROTEÇÃO SOBRETENSÃO', unidade: 'UN', saldoAtual: 3, ultimaAtualizacao: null, precoUnitario: 380.00 },
  ],

  // ── ROS: Resende ──────────────────────────────────────────────────────────
  ROS: [
    { id: 'ROS-001', origem: 'ROS', descricao: 'ESCADA DE FIBRA 6M', unidade: 'UN', saldoAtual: 4, ultimaAtualizacao: '2025-04-15', precoUnitario: 750.00 },
    { id: 'ROS-002', origem: 'ROS', descricao: 'CINTO DE SEGURANÇA TIPO PARAQUEDISTA', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-01-20', precoUnitario: 195.00 },
    { id: 'ROS-003', origem: 'ROS', descricao: 'LUVA ISOLANTE 15KV CLASSE 2', unidade: 'PAR', saldoAtual: 6, ultimaAtualizacao: '2025-05-05', precoUnitario: 320.00 },
  ],

  // ── VVA: Vila Velha (ES) ──────────────────────────────────────────────────
  VVA: [
    { id: 'VVA-001', origem: 'VVA', descricao: 'CABO DE COBRE 16MM² FLEXÍVEL', unidade: 'M', saldoAtual: 800, ultimaAtualizacao: '2025-04-12', precoUnitario: 32.50 },
    { id: 'VVA-002', origem: 'VVA', descricao: 'CONECTOR PERFURANTE DERIVAÇÃO', unidade: 'UN', saldoAtual: 150, ultimaAtualizacao: '2025-03-25', precoUnitario: 18.00 },
    { id: 'VVA-003', origem: 'VVA', descricao: 'POSTE DE CONCRETO 11M 600DAN', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: null, precoUnitario: 1450.00 },
    { id: 'VVA-004', origem: 'VVA', descricao: 'RELIGADOR AUTOMÁTICO 15KV', unidade: 'UN', saldoAtual: 1, ultimaAtualizacao: '2025-02-10', precoUnitario: 28000.00 },
  ],

  // ── CIM: Cariacica Industrial (ES) ────────────────────────────────────────
  CIM: [
    { id: 'CIM-001', origem: 'CIM', descricao: 'TRANSFORMADOR 30KVA 220/380V', unidade: 'UN', saldoAtual: 1, ultimaAtualizacao: '2025-04-22', precoUnitario: 9800.00 },
    { id: 'CIM-002', origem: 'CIM', descricao: 'CHAVE SECCIONADORA 15KV A ÓLEO', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-03-10', precoUnitario: 5200.00 },
    { id: 'CIM-003', origem: 'CIM', descricao: 'CABO ALUMÍNIO 70MM² XLPE', unidade: 'M', saldoAtual: 2500, ultimaAtualizacao: '2025-05-08', precoUnitario: 19.80 },
  ],

  // ── CNA: Cachoeiro de Itapemirim (ES) ─────────────────────────────────────
  CNA: [
    { id: 'CNA-001', origem: 'CNA', descricao: 'MEDIDOR BIFÁSICO ELETRÔNICO', unidade: 'UN', saldoAtual: 22, ultimaAtualizacao: '2025-04-30', precoUnitario: 240.00 },
    { id: 'CNA-002', origem: 'CNA', descricao: 'CABO PP 2 × 4MM²', unidade: 'M', saldoAtual: 0, ultimaAtualizacao: '2025-03-05', precoUnitario: 14.20 },
    { id: 'CNA-003', origem: 'CNA', descricao: 'TRANSFORMADOR DE CORRENTE 50/5A', unidade: 'UN', saldoAtual: 7, ultimaAtualizacao: null, precoUnitario: 450.00 },
  ],

  // ── LNS: Linhares (ES) ────────────────────────────────────────────────────
  LNS: [
    { id: 'LNS-001', origem: 'LNS', descricao: 'ISOLADOR ROLDANA LOUÇA 40MM', unidade: 'UN', saldoAtual: 300, ultimaAtualizacao: '2025-04-18', precoUnitario: 16.50 },
    { id: 'LNS-002', origem: 'LNS', descricao: 'GRAMPO PARALELO 16-95MM²', unidade: 'UN', saldoAtual: 0, ultimaAtualizacao: '2025-02-25', precoUnitario: 8.80 },
    { id: 'LNS-003', origem: 'LNS', descricao: 'CABO MULTIPLEX 2 × 10MM²', unidade: 'M', saldoAtual: 1100, ultimaAtualizacao: '2025-05-10', precoUnitario: 12.40 },
    { id: 'LNS-004', origem: 'LNS', descricao: 'CAIXA DE MEDIÇÃO TRIFÁSICA', unidade: 'UN', saldoAtual: 4, ultimaAtualizacao: null, precoUnitario: 350.00 },
  ],
};

// ─── Funções Públicas Exportadas ──────────────────────────────────────────────

/**
 * Retorna todos os estados disponíveis no sistema.
 * Retorna uma cópia do array para evitar mutação externa.
 *
 * @returns {Array<{ sigla: string, nome: string }>}
 */
export function getEstados() {
  return [...ESTADOS];
}

/**
 * Retorna apenas as siglas dos estados.
 * Útil para validações e listagens simples.
 *
 * @returns {string[]}  ex: ['RJ', 'ES']
 */
export function getTodasUFs() {
  return ESTADOS.map(e => e.sigla);
}

/**
 * Retorna os almoxarifados de um estado pelo código da UF.
 * Retorna array vazio para UF inexistente ou vazia.
 *
 * @param {string} uf  — sigla do estado (ex: 'RJ')
 * @returns {Array<{ codigo: string, label: string }>}
 */
export function getAlmoxarifados(uf) {
  // Guarda contra UF vazia ou inválida
  if (!uf || !ALMOXARIFADOS[uf]) return [];
  return [...ALMOXARIFADOS[uf]];
}

/**
 * Retorna os materiais de um almoxarifado pelo código.
 * Retorna cópias rasas dos objetos para não expor a referência interna.
 * Retorna array vazio para código inexistente ou vazio.
 *
 * @param {string} codigoAlmox  — ex: 'RJO'
 * @returns {Array<Object>}
 */
export function getMateriais(codigoAlmox) {
  // Guarda contra código vazio ou almoxarifado não cadastrado
  if (!codigoAlmox || !MATERIAIS[codigoAlmox]) return [];

  // Retorna cópias para proteger os dados internos de mutação
  return MATERIAIS[codigoAlmox].map(m => ({ ...m }));
}
