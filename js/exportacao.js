/**
 * exportacao.js — Módulo de Exportação do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Responsável por preparar os dados para geração do relatório Excel.
 *
 * PROBLEMA DO SISTEMA ANTERIOR:
 * O export antigo usava XLSX.utils.table_to_book() diretamente no elemento
 * HTML da tabela — isso incluía os campos <input> de nova contagem,
 * gerando um Excel com colunas "sujas" e ilegíveis.
 *
 * SOLUÇÃO AQUI:
 * Construímos os dados manualmente como um array de objetos JS puro,
 * sem nenhum elemento HTML. O XLSX recebe apenas dados limpos.
 *
 * Exporta:
 *   - prepararDadosExport(materiais, contagens) → array de objetos para o XLSX
 *   - gerarNomeArquivo(codigoAlmox)             → nome seguro para o arquivo
 */

// ─── prepararDadosExport ──────────────────────────────────────────────────────

/**
 * Constrói o array de linhas para o arquivo Excel a partir dos dados em memória.
 *
 * Para cada material, gera uma linha com:
 *   - Campos fixos: Origem, Descrição, Unidade, Saldo Anterior
 *   - Campos calculados: Nova Contagem, Divergência (novaQtd - saldo)
 *   - Campos opcionais: Observação, Data da Contagem
 *
 * Se o item NÃO foi contado, os campos de contagem ficam vazios (null).
 *
 * @param {Object[]} materiais  — lista completa de materiais carregados
 * @param {Array<{ id: string, novaQtd: number, observacao?: string }>} contagens
 * @returns {Object[]} array de linhas prontas para XLSX (sem HTML)
 */
export function prepararDadosExport(materiais, contagens) {
  // Lista vazia: retorno imediato sem processamento
  if (!materiais || materiais.length === 0) return [];

  // ── Indexa as contagens por ID para busca O(1) ────────────────────────────
  // Converte o array de contagens em um mapa { id → { novaQtd, observacao } }
  // para evitar nested loops ao cruzar com a lista de materiais
  const mapaContagens = {};
  (contagens || []).forEach(c => {
    mapaContagens[c.id] = {
      novaQtd:    c.novaQtd,
      observacao: c.observacao || '',
    };
  });

  // Captura o horário de geração do relatório (uma vez só para toda a exportação)
  const agora = new Date().toLocaleString('pt-BR');

  // ── Constrói uma linha para cada material ─────────────────────────────────
  return materiais.map(m => {
    const contagem  = mapaContagens[m.id];   // undefined se não contado
    const foiContado = contagem !== undefined;

    // Campos que dependem de o item ter sido contado
    const novaQtd     = foiContado ? contagem.novaQtd    : null;
    const divergencia = foiContado ? (contagem.novaQtd - m.saldoAtual) : null;
    const observacao  = foiContado ? (contagem.observacao || '') : '';

    // Retorna um objeto plano — sem HTML, sem objetos aninhados
    return {
      'Origem':         m.origem    || '',
      'Descrição':      m.descricao || '',
      'Unidade':        m.unidade   || '',
      'Saldo Anterior': m.saldoAtual,
      'Nova Contagem':  novaQtd,       // null = item não contado
      'Divergência':    divergencia,   // positivo = sobra, negativo = falta
      'Observação':     observacao,
      'Data Contagem':  foiContado ? agora : '',
    };
  });
}

// ─── gerarNomeArquivo ─────────────────────────────────────────────────────────

/**
 * Gera um nome de arquivo seguro para o relatório Excel.
 * Substitui as barras "/" por hífens para evitar erros no sistema de arquivos.
 *
 * @param {string} codigoAlmox — ex: 'RJO'
 * @returns {string} ex: "SGI_RJO_20-05-2025.xlsx"
 */
export function gerarNomeArquivo(codigoAlmox) {
  // Formata a data no padrão brasileiro (dd/mm/aaaa)
  // e substitui as barras por hífens (caracteres inválidos em nomes de arquivo)
  const hoje = new Date()
    .toLocaleDateString('pt-BR')  // "20/05/2025"
    .replace(/\//g, '-');         // "20-05-2025"

  return `SGI_${codigoAlmox}_${hoje}.xlsx`;
}
