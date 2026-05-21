/**
 * historico.js — Módulo de Histórico de Contagens do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Mantém um log em memória de todas as contagens realizadas na sessão atual.
 * Cada registro guarda: quem contou (não implementado ainda), quando,
 * valor anterior e valor novo — garantindo rastreabilidade completa.
 *
 * O estado (_historico) é PRIVADO ao módulo.
 * O acesso externo é feito exclusivamente pelas funções exportadas.
 *
 * Exporta:
 *   - adicionarRegistro(params)         → grava uma contagem no log
 *   - getHistorico()                    → retorna cópia imutável do log
 *   - limparHistorico()                 → reseta o log (nova sessão)
 *   - getRegistrosPorItem(id)           → filtra o log por material
 *   - getResumoContagem()               → estatísticas da sessão
 */

// ─── Estado Interno (privado ao módulo) ──────────────────────────────────────
// Array que acumula todos os registros de contagem da sessão.
// Não exportado diretamente — acesso controlado pelas funções abaixo.

/** @type {Array<Object>} */
let _historico = [];

// ─── adicionarRegistro ────────────────────────────────────────────────────────

/**
 * Adiciona um novo registro de contagem ao histórico da sessão.
 * Gera automaticamente o timestamp no momento da chamada.
 *
 * @param {{ id: string, descricao: string, valorAnterior: number, valorNovo: number, observacao?: string }} params
 * @throws {Error} se 'id' não for fornecido
 * @throws {Error} se 'valorNovo' não for um número válido
 *
 * @example
 * adicionarRegistro({
 *   id: 'RJO-001',
 *   descricao: 'CABO DE FORÇA 10MM',
 *   valorAnterior: 350,
 *   valorNovo: 340,
 *   observacao: 'Faltam 10 unidades no setor B'
 * });
 */
export function adicionarRegistro({ id, descricao, valorAnterior, valorNovo, observacao }) {
  // ── Validação: id é obrigatório para rastrear a contagem ─────────────────
  if (!id) {
    throw new Error('O campo "id" é obrigatório para registrar uma contagem.');
  }

  // ── Validação: valorNovo deve ser um número (zero é válido) ───────────────
  if (typeof valorNovo !== 'number' || isNaN(valorNovo)) {
    throw new Error('O campo "valorNovo" deve ser um número válido.');
  }

  // Monta o objeto de registro com timestamp automático
  const registro = {
    id,
    descricao: descricao || '',
    valorAnterior: valorAnterior ?? null, // null se não havia saldo anterior
    valorNovo,
    observacao: observacao || null,       // null = sem observação
    timestamp: new Date().toISOString(),  // ex: "2025-05-20T19:30:00.000Z"
  };

  // Adiciona ao final do array (ordem cronológica)
  _historico.push(registro);
}

// ─── getHistorico ─────────────────────────────────────────────────────────────

/**
 * Retorna uma CÓPIA do histórico completo (mais antigo primeiro).
 * A cópia protege o estado interno de mutações externas acidentais.
 *
 * @returns {Object[]} array de registros, em ordem de inserção
 */
export function getHistorico() {
  // Mapeia para cópias rasas — impede que o chamador altere o estado interno
  return _historico.map(r => ({ ...r }));
}

// ─── limparHistorico ──────────────────────────────────────────────────────────

/**
 * Limpa todos os registros do histórico.
 * Chamado ao iniciar uma nova sessão de contagem ou trocar de almoxarifado.
 */
export function limparHistorico() {
  _historico = [];
}

// ─── getRegistrosPorItem ──────────────────────────────────────────────────────

/**
 * Retorna todos os registros de histórico de um material específico.
 * Permite exibir o histórico de recontagens de um item na UI.
 *
 * @param {string} id — identificador do material (ex: 'RJO-001')
 * @returns {Object[]} registros filtrados pelo id (cópias)
 *
 * @example
 * getRegistrosPorItem('RJO-001') // [{ id: 'RJO-001', valorAnterior: 350, valorNovo: 340, ... }]
 */
export function getRegistrosPorItem(id) {
  return _historico
    .filter(r => r.id === id)
    .map(r => ({ ...r })); // retorna cópias, não referências
}

// ─── getResumoContagem ───────────────────────────────────────────────────────

/**
 * Calcula e retorna estatísticas resumidas da sessão de contagem.
 * Exibido no modal de confirmação antes de salvar.
 *
 * - totalContados:    número de itens que foram contados (registros no log)
 * - totalDivergencias: itens cujo valor contado difere do saldo anterior
 *
 * @returns {{ totalContados: number, totalDivergencias: number }}
 *
 * @example
 * getResumoContagem()
 * // { totalContados: 5, totalDivergencias: 2 }
 */
export function getResumoContagem() {
  const totalContados = _historico.length;

  // Uma divergência ocorre quando o valor contado ≠ saldo anterior do sistema
  const totalDivergencias = _historico.filter(
    r => r.valorNovo !== r.valorAnterior
  ).length;

  return { totalContados, totalDivergencias };
}
