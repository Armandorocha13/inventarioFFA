/**
 * validacao.js — Módulo de Validação de Entradas do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Centraliza todas as regras de validação para garantir que nenhum dado
 * inválido chegue ao backend (ou à fonte de dados).
 *
 * Todas as funções retornam um objeto { valido: boolean, erro?: string }
 * para facilitar o uso na UI (exibir mensagens de erro específicas).
 *
 * Exporta:
 *   - validarQuantidade(valor, opcoes)  → valida um único número de contagem
 *   - validarContagens(contagens)       → valida um lote de contagens antes de salvar
 *   - validarObservacao(texto)          → valida o campo de observação por item
 */

// ─── validarQuantidade ────────────────────────────────────────────────────────

/**
 * Valida um valor de quantidade para uso na contagem de materiais.
 *
 * Regras padrão:
 *   ✅ Aceita: 0, inteiros positivos, strings numéricas ("10")
 *   ❌ Rejeita: negativos, NaN, null, undefined, strings vazias, decimais (padrão)
 *
 * @param {*} valor — valor digitado pelo usuário no campo de nova contagem
 * @param {{ allowDecimal?: boolean, max?: number }} [opcoes]
 *   - allowDecimal: permite números decimais (padrão: false)
 *   - max: valor máximo permitido (opcional)
 * @returns {{ valido: boolean, erro?: string }}
 *
 * @example
 * validarQuantidade(42)            // { valido: true }
 * validarQuantidade(-1)            // { valido: false, erro: '...' }
 * validarQuantidade(1.5)           // { valido: false, erro: '...' }
 * validarQuantidade(1.5, { allowDecimal: true }) // { valido: true }
 */
export function validarQuantidade(valor, opcoes = {}) {
  const { allowDecimal = false, max } = opcoes;

  // ── Guarda 1: nulo ou undefined ──────────────────────────────────────────
  if (valor === null || valor === undefined) {
    return { valido: false, erro: 'Quantidade não pode ser vazia.' };
  }

  // ── Guarda 2: string vazia ────────────────────────────────────────────────
  if (typeof valor === 'string' && valor.trim() === '') {
    return { valido: false, erro: 'Quantidade não pode ser vazia.' };
  }

  // Converte para número para validações numéricas
  const num = Number(valor);

  // ── Guarda 3: NaN (ex: letras, símbolos) ─────────────────────────────────
  if (isNaN(num)) {
    return { valido: false, erro: 'Quantidade deve ser um número válido.' };
  }

  // ── Guarda 4: número negativo ─────────────────────────────────────────────
  if (num < 0) {
    return { valido: false, erro: 'Quantidade não pode ser negativa.' };
  }

  // ── Guarda 5: decimal não permitido ──────────────────────────────────────
  // Materiais geralmente são contados em unidades inteiras
  if (!allowDecimal && !Number.isInteger(num)) {
    return { valido: false, erro: 'Quantidade deve ser um número inteiro.' };
  }

  // ── Guarda 6: valor acima do máximo definido ──────────────────────────────
  if (max !== undefined && num > max) {
    return { valido: false, erro: `Quantidade não pode ser maior que ${max}.` };
  }

  return { valido: true };
}

// ─── validarContagens ────────────────────────────────────────────────────────

/**
 * Valida um array completo de contagens antes do envio para salvar.
 * Chamada no momento em que o usuário clica em "Finalizar Atualização".
 *
 * @param {Array<{ id?: string, novaQtd: number }>} contagens
 * @returns {{ valido: boolean, erro?: string, idsInvalidos?: string[] }}
 *   - idsInvalidos: lista de IDs com quantidades inválidas (para destacar na UI)
 *
 * @example
 * validarContagens([{ id: '1', novaQtd: 10 }]) // { valido: true, idsInvalidos: [] }
 * validarContagens([])                          // { valido: false, erro: '...' }
 */
export function validarContagens(contagens) {
  // ── Guarda 1: array vazio (usuário não digitou nada) ─────────────────────
  if (!Array.isArray(contagens) || contagens.length === 0) {
    return { valido: false, erro: 'Nenhuma contagem foi inserida.' };
  }

  // Coleta os IDs que tiverem quantidade inválida
  const idsInvalidos = [];

  for (const item of contagens) {
    // ── Guarda 2: item sem identificador ────────────────────────────────────
    if (!item.id) {
      return { valido: false, erro: 'Item sem identificador encontrado.', idsInvalidos };
    }

    // Reutiliza a validação de quantidade unitária
    const resultado = validarQuantidade(item.novaQtd);
    if (!resultado.valido) {
      idsInvalidos.push(item.id);
    }
  }

  // ── Guarda 3: algum item com quantidade inválida ─────────────────────────
  if (idsInvalidos.length > 0) {
    return {
      valido: false,
      erro: `Quantidade inválida em ${idsInvalidos.length} item(ns).`,
      idsInvalidos,
    };
  }

  return { valido: true, idsInvalidos: [] };
}

// ─── validarObservacao ────────────────────────────────────────────────────────

/**
 * Valida o texto de observação de um item.
 * A observação é OPCIONAL: null/undefined são aceitos sem erro.
 *
 * Regras:
 *   ✅ Aceita: null, undefined, string vazia, qualquer texto até 500 chars
 *   ❌ Rejeita: textos acima de 500 caracteres
 *
 * @param {string|null|undefined} texto
 * @returns {{ valido: boolean, erro?: string }}
 */
export function validarObservacao(texto) {
  // A ausência de observação é totalmente válida
  if (texto === null || texto === undefined) return { valido: true };

  if (typeof texto !== 'string') {
    return { valido: false, erro: 'Observação deve ser um texto.' };
  }

  // Limite de caracteres para evitar dados excessivamente grandes
  const LIMITE = 500;
  if (texto.length > LIMITE) {
    return { valido: false, erro: `Observação não pode ultrapassar ${LIMITE} caracteres.` };
  }

  return { valido: true };
}
