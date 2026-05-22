/**
 * filtros.js — Módulo de Filtro, Ordenação e Debounce do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsável por toda a lógica de busca e ordenação da tabela de materiais.
 * Todas as funções são PURAS: não modificam o array original.
 *
 * Exporta:
 *   - filtrarMateriais(materiais, termo)     → busca multi-coluna
 *   - ordenarPor(materiais, coluna, direcao) → ordenação imutável
 *   - debounce(fn, delay)                    → atrasa execução de funções
 */

// ─── filtrarMateriais ─────────────────────────────────────────────────────────

/**
 * Filtra a lista de materiais por um termo de busca.
 *
 * A busca é feita nas colunas: descricao, origem e unidade.
 * É case-insensitive (maiúsculas e minúsculas são tratadas igualmente).
 * O array original NÃO é modificado — retorna uma nova lista.
 *
 * @param {Object[]} materiais — lista completa de materiais
 * @param {string}   termo     — texto digitado pelo usuário no campo de busca
 * @returns {Object[]}         — nova lista contendo apenas os itens que batem
 *
 * @example
 * filtrarMateriais(lista, 'cabo')  // retorna itens com "CABO" na descrição
 * filtrarMateriais(lista, 'rjo')   // retorna itens com origem "RJO"
 * filtrarMateriais(lista, '')      // retorna todos (sem filtro)
 */
export function filtrarMateriais(materiais, filtro, contagens = {}, apenasDivergentes = false) {
  let resultado = [...materiais];

  if (apenasDivergentes) {
    resultado = resultado.filter(m => {
      const temContagem = m.id in contagens;
      if (!temContagem) return false;
      return contagens[m.id].novaQtd !== m.saldoAtual;
    });
  }

  // Compatibilidade com busca textual antiga e testes legados
  if (typeof filtro === 'string') {
    if (!filtro || filtro.trim() === '') return resultado;
    const termoUpper = filtro.trim().toUpperCase();
    return resultado.filter(m => {
      const descricao = (m.descricao || '').toUpperCase();
      const origem    = (m.origem    || '').toUpperCase();
      const unidade   = (m.unidade   || '').toUpperCase();
      return (
        descricao.includes(termoUpper) ||
        origem.includes(termoUpper)    ||
        unidade.includes(termoUpper)
      );
    });
  }

  // Filtros rápidos estruturados (objeto)
  if (filtro && typeof filtro === 'object') {
    const { termo, tipo, unidade, saldo } = filtro;

    // 1. Filtro por Busca Textual
    if (termo && termo.trim() !== '') {
      const termoUpper = termo.trim().toUpperCase();
      resultado = resultado.filter(m => {
        const descricao = (m.descricao || '').toUpperCase();
        const origem    = (m.origem    || '').toUpperCase();
        const uni       = (m.unidade   || '').toUpperCase();
        return (
          descricao.includes(termoUpper) ||
          origem.includes(termoUpper)    ||
          uni.includes(termoUpper)
        );
      });
    }

    // 2. Filtro por Tipo de Material (agora utiliza a descrição exata do material carregada no <select>)
    if (tipo && tipo !== 'todos') {
      resultado = resultado.filter(m => (m.descricao || '') === tipo);
    }

    // 3. Filtro por Unidade de Medida
    if (unidade && unidade !== 'todas') {
      resultado = resultado.filter(m => (m.unidade || '').toUpperCase() === unidade.toUpperCase());
    }

    // 4. Filtro por Status do Saldo
    if (saldo && saldo !== 'todos') {
      if (saldo === 'disponivel') {
        resultado = resultado.filter(m => m.saldoAtual > 0);
      } else if (saldo === 'zerado') {
        resultado = resultado.filter(m => m.saldoAtual === 0);
      }
    }
  }

  return resultado;
}

// ─── ordenarPor ──────────────────────────────────────────────────────────────

/**
 * Ordena a lista de materiais por uma coluna, em ordem crescente ou decrescente.
 * Valores null/undefined são sempre posicionados ao FINAL da lista.
 * O array original NÃO é modificado — retorna uma nova lista ordenada.
 *
 * @param {Object[]}        materiais — lista de materiais
 * @param {string}          coluna    — nome da propriedade a ordenar (ex: 'descricao', 'saldoAtual')
 * @param {'asc' | 'desc'}  direcao   — sentido da ordenação (padrão: 'asc')
 * @returns {Object[]}                — nova lista ordenada
 *
 * @example
 * ordenarPor(lista, 'descricao', 'asc')   // A → Z
 * ordenarPor(lista, 'saldoAtual', 'desc') // maior primeiro
 */
export function ordenarPor(materiais, coluna, direcao = 'asc') {
  // Lista vazia: retorna imediatamente
  if (!materiais.length) return [];

  // Multiplicador: +1 para ascendente, -1 para descendente
  const mult = direcao === 'desc' ? -1 : 1;

  // Cria uma cópia rasa antes de ordenar para não mutar o original
  return [...materiais].sort((a, b) => {
    const va = a[coluna];
    const vb = b[coluna];

    // Valores nulos sempre vão para o final (independente da direção)
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;

    // Comparação numérica (ex: saldoAtual)
    if (typeof va === 'number' && typeof vb === 'number') {
      return mult * (va - vb);
    }

    // Comparação de strings (ex: descricao, origem)
    const sa = String(va).toUpperCase();
    const sb = String(vb).toUpperCase();
    if (sa < sb) return mult * -1;
    if (sa > sb) return mult * 1;
    return 0; // valores iguais
  });
}

// ─── debounce ────────────────────────────────────────────────────────────────

/**
 * Cria uma versão "debounced" de uma função.
 *
 * Útil para evitar que a busca seja disparada a cada tecla pressionada.
 * A função original só é executada após `delay` milissegundos sem novas chamadas.
 * Cada chamada reinicia o timer.
 *
 * @param {Function} fn    — função original a ser atrasada
 * @param {number}   delay — tempo de espera em milissegundos
 * @returns {Function}     — versão debounced da função
 *
 * @example
 * const buscaDebounced = debounce(filtrar, 300);
 * inputBusca.addEventListener('input', buscaDebounced);
 */
export function debounce(fn, delay) {
  // Timer interno que é reiniciado a cada chamada
  let timer = null;

  return function (...args) {
    // Cancela o timer anterior (se ainda estiver aguardando)
    clearTimeout(timer);

    // Agenda a execução da função original após o delay
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
