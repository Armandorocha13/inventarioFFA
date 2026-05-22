/**
 * Processador auxiliar de importação de planilhas.
 * Contém funções puras para processar e filtrar dados sem efeitos colaterais de banco de dados.
 */

/**
 * Converte um valor genérico para um número válido, tratando vírgulas decimais e valores vazios.
 * @param {any} val - Valor bruto do Excel.
 * @returns {number} - Número convertido ou 0 em caso de erro/vazio.
 */
export function parseNumeric(val) {
  if (val === undefined || val === null || String(val).trim() === '') return 0;
  // Substituir vírgula por ponto para suportar notação PT-BR
  const cleanVal = String(val).replace(',', '.');
  const num = Number(cleanVal);
  return isNaN(num) ? 0 : num;
}

/**
 * Mapeia os índices das colunas reais baseando-se no mapeamento de cabeçalhos desejado.
 * @param {Array<string>} rawHeaders - Primeira linha de cabeçalhos brutos da planilha.
 * @param {Object} headerMapping - Objeto de mapeamento (Nome do Excel => Nome do Banco).
 * @returns {Object} - Índices correspondentes no formato { nome_do_banco: indice_excel }.
 */
export function mapearCabecalhos(rawHeaders, headerMapping) {
  const headerIndices = {};
  if (!Array.isArray(rawHeaders)) return headerIndices;

  rawHeaders.forEach((header, index) => {
    if (header && headerMapping[header]) {
      headerIndices[headerMapping[header]] = index;
    }
  });

  return headerIndices;
}

/**
 * Processa a planilha inteira (matriz de linhas), descarta o título da primeira linha,
 * mapeia os cabeçalhos da segunda linha, e filtra/limpa os dados correspondentes.
 * @param {Array<Array<any>>} rows - Matriz de linhas da planilha Excel.
 * @param {Object} headerMapping - Mapeamento de colunas de cabeçalho.
 * @param {Array<string>} dbColumns - Array das colunas finais do banco.
 * @returns {Array<Object>} - Lista de objetos processados e filtrados.
 */
export function filtrarEProcessarDados(rows, headerMapping, dbColumns) {
  if (!Array.isArray(rows) || rows.length < 2) return [];

  // Linha 1 (index 0) é ignorada (título)
  // Linha 2 (index 1) contém as chaves dos cabeçalhos reais
  const rawHeaders = rows[1];
  const headerIndices = mapearCabecalhos(rawHeaders, headerMapping);

  // Validar se codmat foi encontrado
  if (headerIndices['codmat'] === undefined) {
    return [];
  }

  const processedData = [];

  // Linha 3 (index 2) em diante contém os dados reais
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Verificar se o codmat atende ao filtro
    const rawCodmat = row[headerIndices['codmat']];
    const codmatStr = rawCodmat !== undefined && rawCodmat !== null ? String(rawCodmat).trim() : '';

    if (codmatStr.startsWith('1000')) {
      const mappedRow = {};

      dbColumns.forEach(col => {
        // Se a coluna for grupo_codigo e a tabela tiver grupo no mapeamento
        if (col === 'grupo_codigo' && dbColumns.includes('grupo') && headerIndices['grupo'] !== undefined) {
          const rawGrupo = row[headerIndices['grupo']];
          if (rawGrupo !== null && rawGrupo !== undefined) {
            const rawGrupoStr = String(rawGrupo).trim();
            if (rawGrupoStr.includes('/')) {
              mappedRow['grupo_codigo'] = rawGrupoStr.split('/')[0].trim();
            } else {
              mappedRow['grupo_codigo'] = null;
            }
          } else {
            mappedRow['grupo_codigo'] = null;
          }
          return;
        }

        const index = headerIndices[col];
        let val = index !== undefined ? row[index] : null;

        // Tratar conversão de tipos específicos
        if (['saldo_estoque', 'prog_rm', 'prog_tm', 'saldo_disponivel', 'valor'].includes(col)) {
          val = parseNumeric(val);
        } else if (val !== null && val !== undefined) {
          // Tratar códigos e textos gerais como strings limpas
          val = String(val).trim();
        } else {
          val = null;
        }

        // Se a coluna for grupo e grupo_codigo também estiver no dbColumns
        if (col === 'grupo' && dbColumns.includes('grupo_codigo') && val !== null) {
          if (val.includes('/')) {
            val = val.substring(val.indexOf('/') + 1).trim();
          }
        }

        mappedRow[col] = val;
      });

      processedData.push(mappedRow);
    }
  }

  return processedData;
}

/**
 * Analisa os dados já mapeados e filtrados e detecta quais colunas possuem ao menos uma
 * informação útil (não nula, não indefinida e não vazia).
 * @param {Array<Object>} dados - Lista de registros mapeados e filtrados.
 * @param {Array<string>} colunasDisponiveis - Lista completa de colunas candidatas.
 * @returns {Array<string>} - Lista de colunas que possuem dados válidos em algum registro.
 */
export function detectarColunasAtivas(dados, colunasDisponiveis) {
  if (!Array.isArray(dados) || dados.length === 0 || !Array.isArray(colunasDisponiveis)) {
    return [];
  }

  const colunasAtivas = [];

  colunasDisponiveis.forEach(col => {
    // Verificar se existe ao menos um registro com valor preenchido nesta coluna
    const temInformacao = dados.some(row => {
      const val = row[col];
      return val !== null && val !== undefined && String(val).trim() !== '';
    });

    if (temInformacao) {
      colunasAtivas.push(col);
    }
  });

  return colunasAtivas;
}

/**
 * Processa a planilha de De-Para (matriz de linhas), lê cabeçalhos na primeira linha,
 * e mapeia/limpa todos os registros do De-Para de contratos e projetos.
 * @param {Array<Array<any>>} rows - Matriz de linhas da planilha.
 * @param {Object} headerMapping - Mapeamento de colunas de cabeçalho.
 * @param {Array<string>} dbColumns - Array das colunas finais do banco.
 * @returns {Array<Object>} - Lista de objetos processados.
 */
export function processarDePara(rows, headerMapping, dbColumns) {
  if (!Array.isArray(rows) || rows.length < 1) return [];

  // Linha 1 (index 0) contém as chaves dos cabeçalhos reais
  const rawHeaders = rows[0];
  const headerIndices = mapearCabecalhos(rawHeaders, headerMapping);

  const processedData = [];

  // Linha 2 (index 1) em diante contém os dados
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const mappedRow = {};
    let hasData = false;

    dbColumns.forEach(col => {
      const index = headerIndices[col];
      let val = index !== undefined ? row[index] : null;

      if (col === 'contrato') {
        val = parseNumeric(val);
        if (val !== 0) hasData = true;
      } else if (val !== null && val !== undefined && String(val).trim() !== '') {
        val = String(val).trim();
        hasData = true;
      } else {
        val = null;
      }

      mappedRow[col] = val;
    });

    if (hasData) {
      processedData.push(mappedRow);
    }
  }

  return processedData;
}
