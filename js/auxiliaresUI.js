/**
 * auxiliaresUI.js — Funções Auxiliares Puras de Interface do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Contém funções PURAS de suporte à interface: formatação, classificação,
 * cálculos de progresso e proteção contra XSS.
 *
 * "Puras" significa: sem efeitos colaterais, sem acesso ao DOM.
 * Isso torna todas as funções facilmente testáveis de forma isolada.
 *
 * Exporta:
 *   - formatarData(isoString)                → "dd/mm/aaaa" ou "Sem data"
 *   - getBadgeClass(quantidade)              → classe CSS do badge de saldo
 *   - calcularProgresso(materiais, contagens)→ { total, contados, percentual }
 *   - sanitizarTexto(texto)                  → remove tags HTML (anti-XSS)
 *   - truncarTexto(texto, limite)            → corta textos longos com "..."
 */

// ─── formatarData ─────────────────────────────────────────────────────────────

/**
 * Converte uma string de data ISO (ex: "2025-05-20") para o formato
 * brasileiro dd/mm/aaaa. Usa UTC para evitar erros de fuso horário.
 *
 * @param {string|null|undefined} isoString — data no formato ISO 8601
 * @returns {string} data formatada, "Sem data" ou "Data inválida"
 *
 * @example
 * formatarData('2025-05-20')    // "20/05/2025"
 * formatarData(null)            // "Sem data"
 * formatarData('nao-e-data')    // "Data inválida"
 */
export function formatarData(isoString) {
  // Valores ausentes: retorna texto amigável
  if (!isoString) return 'Sem data';

  const date = new Date(isoString);

  // Date inválida (ex: string que não é data)
  if (isNaN(date.getTime())) return 'Data inválida';

  // Usa getUTC* para evitar deslocamento de fuso horário
  // (ex: "2025-01-01" em UTC-3 poderia virar "31/12/2024" com getDate())
  const dia  = String(date.getUTCDate()).padStart(2, '0');
  const mes  = String(date.getUTCMonth() + 1).padStart(2, '0'); // mês é 0-indexed
  const ano  = date.getUTCFullYear();

  return `${dia}/${mes}/${ano}`;
}

// ─── getBadgeClass ────────────────────────────────────────────────────────────

/**
 * Retorna a classe CSS do badge colorido de saldo, com base na quantidade.
 *
 * Classificação:
 *   ≤ 0     → 'badge-zero' → vermelho  (zerado ou inválido)
 *   1 a 10  → 'badge-low'  → âmbar     (estoque baixo, atenção)
 *   > 10    → 'badge-ok'   → verde     (estoque normal)
 *
 * @param {number} quantidade — saldo atual do material
 * @returns {string} classe CSS
 *
 * @example
 * getBadgeClass(0)   // "badge-zero"
 * getBadgeClass(5)   // "badge-low"
 * getBadgeClass(100) // "badge-ok"
 */
export function getBadgeClass(quantidade) {
  if (quantidade <= 0)  return 'badge-zero'; // zero ou negativo (dado inválido)
  if (quantidade <= 10) return 'badge-low';  // estoque baixo
  return 'badge-ok';                         // estoque normal
}

// ─── calcularProgresso ────────────────────────────────────────────────────────

/**
 * Calcula o progresso da contagem: quantos itens já foram preenchidos.
 * Um item é considerado "contado" se seu ID estiver presente no mapa de contagens,
 * mesmo que o valor digitado seja 0 (zero explícito é uma contagem válida).
 *
 * @param {Object[]} materiais  — lista completa de materiais ({ id, ... })
 * @param {Object}   contagens  — mapa { [id]: novaQtd } com os itens já digitados
 * @returns {{ total: number, contados: number, percentual: number }}
 *   - total:     total de itens no almoxarifado
 *   - contados:  itens já preenchidos pelo usuário
 *   - percentual: progresso arredondado para inteiro (0–100)
 *
 * @example
 * calcularProgresso([{id:'1'},{id:'2'}], {'1': 10})
 * // { total: 2, contados: 1, percentual: 50 }
 */
export function calcularProgresso(materiais, contagens) {
  const total = materiais.length;

  // Lista vazia: não há como calcular progresso
  if (total === 0) return { total: 0, contados: 0, percentual: 0 };

  // Conta quantos IDs da lista de materiais estão presentes no mapa de contagens
  // O operador 'in' detecta inclusive quando o valor é 0 (chave existe no objeto)
  const contados = materiais.filter(m => m.id in contagens).length;

  // Arredonda para baixo (floor) para não mostrar 100% antes de terminar
  const percentual = Math.floor((contados / total) * 100);

  return { total, contados, percentual };
}

// ─── sanitizarTexto ──────────────────────────────────────────────────────────

/**
 * Remove/escapa tags HTML de uma string para prevenir ataques XSS.
 * Deve ser usada SEMPRE antes de inserir dados do usuário no DOM via innerHTML.
 *
 * Substitui os caracteres especiais do HTML por suas entidades:
 *   &  → &amp;
 *   <  → &lt;
 *   >  → &gt;
 *   "  → &quot;
 *   '  → &#039;
 *
 * @param {string|null|undefined} texto — texto bruto (pode conter HTML malicioso)
 * @returns {string} texto seguro para inserção no DOM
 *
 * @example
 * sanitizarTexto('<script>alert("xss")</script>')
 * // "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
export function sanitizarTexto(texto) {
  // Trata valores ausentes como string vazia
  if (texto === null || texto === undefined) return '';

  return String(texto)
    .replace(/&/g, '&amp;')    // deve ser o primeiro (evitar dupla-substituição)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── truncarTexto ────────────────────────────────────────────────────────────

/**
 * Trunca um texto longo para caber em células da tabela,
 * adicionando "..." ao final quando necessário.
 *
 * @param {string|null|undefined} texto  — texto a truncar
 * @param {number}                limite — número máximo de caracteres visíveis
 * @returns {string}
 *
 * @example
 * truncarTexto('CABO DE FORÇA 10MM ISOLADO', 15)
 * // "CABO DE FORÇA 1..."
 */
export function truncarTexto(texto, limite) {
  // Trata valores ausentes como string vazia
  if (texto === null || texto === undefined) return '';

  const str = String(texto);

  // Se cabe no limite, retorna sem modificação
  if (str.length <= limite) return str;

  // Corta e adiciona reticências
  return str.slice(0, limite) + '...';
}

// ─── formatarMoeda ────────────────────────────────────────────────────────────

/**
 * Formata um valor numérico para representação monetária brasileira (R$ X.XXX,XX).
 *
 * @param {number} valor — valor a formatar
 * @returns {string} valor formatado
 */
export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

// ─── calcularAcuracidade ──────────────────────────────────────────────────────

/**
 * Calcula estatísticas de acuracidade física com base nas contagens digitadas.
 * A taxa de acuracidade é a proporção de acertos sobre os itens contados.
 *
 * @param {Object[]} materiais - materiais carregados
 * @param {Object} contagens - mapa de contagens
 * @returns {Object} estatísticas de acuracidade
 */
export function calcularAcuracidade(materiais, contagens) {
  const total = materiais.length;
  if (total === 0) {
    return { total: 0, contados: 0, acertos: 0, divergentes: 0, taxaAcuracidade: 100 };
  }

  const contagensRealizadas = materiais.filter(m => m.id in contagens);
  const contados = contagensRealizadas.length;

  if (contados === 0) {
    return { total, contados: 0, acertos: 0, divergentes: 0, taxaAcuracidade: 100 };
  }

  let acertos = 0;
  let divergentes = 0;

  contagensRealizadas.forEach(m => {
    const contagem = contagens[m.id];
    if (contagem.novaQtd === m.saldoAtual) {
      acertos++;
    } else {
      divergentes++;
    }
  });

  const taxaAcuracidade = Math.round((acertos / contados) * 100);

  return { total, contados, acertos, divergentes, taxaAcuracidade };
}

// ─── calcularFinanceiroDivergencias ───────────────────────────────────────────

/**
 * Calcula o impacto financeiro das divergências encontradas nas contagens.
 *
 * @param {Object[]} materiais - materiais carregados
 * @param {Object} contagens - mapa de contagens
 * @returns {Object} detalhamento financeiro das perdas e sobras
 */
export function calcularFinanceiroDivergencias(materiais, contagens) {
  let distorcaoPatrimonial = 0;
  let resultadoLiquido = 0;
  const detalhes = [];

  materiais.forEach(m => {
    if (m.id in contagens) {
      const novaQtd = contagens[m.id].novaQtd;
      if (novaQtd !== m.saldoAtual) {
        const desvio = novaQtd - m.saldoAtual;
        const preco = m.precoUnitario || 0;
        const impacto = desvio * preco;

        distorcaoPatrimonial += Math.abs(impacto);
        resultadoLiquido += impacto;

        detalhes.push({
          id: m.id,
          descricao: m.descricao,
          desvio,
          precoUnitario: preco,
          impacto
        });
      }
    }
  });

  return {
    distorcaoPatrimonial,
    resultadoLiquido,
    detalhes
  };
}

// ─── classificarCurvaABC ──────────────────────────────────────────────────────

/**
 * Classifica os materiais em faixas estratégicas A, B e C com base no valor estocado.
 * Também calcula a acuracidade de contagem individual por classe.
 *
 * @param {Object[]} materiais - materiais carregados
 * @param {Object} contagens - mapa de contagens
 * @returns {Object} dados da curva ABC
 */
export function classificarCurvaABC(materiais, contagens = {}) {
  const totalMateriais = materiais.length;
  if (totalMateriais === 0) {
    return {
      classes: { A: [], B: [], C: [] },
      acuracidadePorClasse: { A: 100, B: 100, C: 100 },
      valorTotalEstoque: 0
    };
  }

  // Calcula o valor em estoque para cada item
  const itensComValor = materiais.map(m => {
    const valor = m.saldoAtual * (m.precoUnitario || 0);
    return { ...m, valorEstoque: valor };
  });

  // Ordena decrescente por valor
  itensComValor.sort((a, b) => b.valorEstoque - a.valorEstoque);

  const valorTotalEstoque = itensComValor.reduce((acc, i) => acc + i.valorEstoque, 0);

  const classes = { A: [], B: [], C: [] };
  let acumulado = 0;

  itensComValor.forEach(item => {
    acumulado += item.valorEstoque;
    const percentualAcumulado = valorTotalEstoque > 0 ? (acumulado / valorTotalEstoque) * 100 : 0;

    if (percentualAcumulado <= 80 || classes.A.length === 0) {
      classes.A.push(item);
    } else if (percentualAcumulado <= 95) {
      classes.B.push(item);
    } else {
      classes.C.push(item);
    }
  });

  if (valorTotalEstoque === 0) {
    classes.A = [];
    classes.B = [];
    classes.C = [...itensComValor];
  }

  // Calcula acuracidade de contagem de cada classe
  const acuracidadePorClasse = {};
  ['A', 'B', 'C'].forEach(classe => {
    const itensClasse = classes[classe];
    const stats = calcularAcuracidade(itensClasse, contagens);
    acuracidadePorClasse[classe] = stats.taxaAcuracidade;
  });

  return {
    classes,
    acuracidadePorClasse,
    valorTotalEstoque
  };
}
