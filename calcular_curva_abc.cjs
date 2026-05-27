/**
 * calcular_curva_abc.js
 * Lê a aba CURVA do arquivo curva.xlsx, calcula o Pareto (Curva ABC)
 * e escreve as colunas "% Individual", "% Acumulada" e "Classificação"
 * diretamente na aba CURVA.
 *
 * Critério clássico de Pareto:
 *   Classe A → % acumulada até 70%  (itens de maior movimentação)
 *   Classe B → % acumulada até 90%  (movimentação intermediária)
 *   Classe C → % acumulada >  90%  (menor movimentação)
 */

const XLSX = require('xlsx');
const path = require('path');

const FILE_PATH = path.resolve('curva.xlsx');
const SHEET_NAME = 'CURVA';

// Limites do Pareto
const LIMITE_A = 70;  // até 70% acumulado → Classe A
const LIMITE_B = 90;  // até 90% acumulado → Classe B
                      // acima de 90%       → Classe C

console.log('📂 Lendo arquivo:', FILE_PATH);
const wb = XLSX.readFile(FILE_PATH);

const ws = wb.Sheets[SHEET_NAME];
if (!ws) {
  console.error(`❌ Aba "${SHEET_NAME}" não encontrada no arquivo.`);
  process.exit(1);
}

// Ler como array de arrays para preservar formatação existente
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log(`📊 Total de linhas na aba ${SHEET_NAME}: ${data.length}`);

// Identificar linha de cabeçalho (linha 0) e índice da coluna QUANTIDADE
const header = data[0];
const colQtd = header.indexOf('QUANTIDADE');
if (colQtd === -1) {
  console.error('❌ Coluna "QUANTIDADE" não encontrada no cabeçalho.');
  process.exit(1);
}

// Separar linhas de dados (ignora cabeçalho e a linha TOTAL no final)
const linhasDados = data.slice(1).filter(
  row => row[0] && String(row[0]).toUpperCase() !== 'TOTAL' && row[colQtd] !== ''
);

console.log(`🔢 Itens de dados encontrados: ${linhasDados.length}`);

// Calcular total geral (soma de todas as quantidades)
const totalGeral = linhasDados.reduce((acc, row) => acc + (Number(row[colQtd]) || 0), 0);
console.log(`📈 Total geral de saídas: ${totalGeral.toLocaleString('pt-BR')}`);

// Garantir que já estão ordenados por quantidade decrescente (maior → menor)
// O arquivo já parece estar ordenado, mas ordenamos para garantir
linhasDados.sort((a, b) => (Number(b[colQtd]) || 0) - (Number(a[colQtd]) || 0));

// Calcular % Individual, % Acumulada e Classificação
let acumulado = 0;
const resultados = linhasDados.map(row => {
  const qtd = Number(row[colQtd]) || 0;
  const pctIndividual = (qtd / totalGeral) * 100;
  acumulado += pctIndividual;

  let classe;
  if (acumulado <= LIMITE_A) {
    classe = 'A';
  } else if (acumulado <= LIMITE_B) {
    classe = 'B';
  } else {
    classe = 'C';
  }

  return {
    row,
    pctIndividual,
    pctAcumulada: acumulado,
    classe,
  };
});

// Resumo por classe
const resumo = { A: 0, B: 0, C: 0 };
resultados.forEach(r => resumo[r.classe]++);
console.log(`\n📊 Distribuição da Curva ABC:`);
console.log(`   Classe A: ${resumo.A} itens (até ${LIMITE_A}% acumulado)`);
console.log(`   Classe B: ${resumo.B} itens (${LIMITE_A}% a ${LIMITE_B}% acumulado)`);
console.log(`   Classe C: ${resumo.C} itens (acima de ${LIMITE_B}% acumulado)`);

// Adicionar novas colunas ao cabeçalho
// Descobrir quantas colunas existem atualmente
const numColsExistentes = header.length;

// Índices das novas colunas (após as existentes)
// Col E (índice 4) = % Individual, Col F (índice 5) = % Acumulada, Col G (índice 6) = Classificação
const COL_PCT_IND  = 4;
const COL_PCT_ACU  = 5;
const COL_CLASSE   = 6;

// Atualizar cabeçalho na linha 0
data[0][COL_PCT_IND] = '% Individual';
data[0][COL_PCT_ACU] = '% Acumulada';
data[0][COL_CLASSE]  = 'Classificação';

// Reescrever linhas de dados na posição correta (mantendo ordem decrescente de quantidade)
// Primeiro, reordenar data com as linhas de dados já calculadas
// Remover as linhas de dados antigas (linhas 1 até penúltima, excluindo TOTAL)
// e substituir pelos dados ordenados + calculados

const linhaTotalOriginal = data[data.length - 1]; // linha "TOTAL"

// Reconstruir array: cabeçalho + dados ordenados com colunas novas + linha TOTAL
const novaData = [data[0]];  // cabeçalho

resultados.forEach(({ row, pctIndividual, pctAcumulada, classe }) => {
  const novaLinha = [...row];
  // Garantir tamanho mínimo
  while (novaLinha.length <= COL_CLASSE) novaLinha.push('');
  novaLinha[COL_PCT_IND] = Math.round(pctIndividual * 100) / 100;   // arredonda 2 casas
  novaLinha[COL_PCT_ACU] = Math.round(pctAcumulada * 100) / 100;    // arredonda 2 casas
  novaLinha[COL_CLASSE]  = classe;
  novaData.push(novaLinha);
});

// Adicionar linha TOTAL ao final (sem colunas ABC)
const linhaTotalNova = [...linhaTotalOriginal];
while (linhaTotalNova.length <= COL_CLASSE) linhaTotalNova.push('');
linhaTotalNova[COL_PCT_IND] = 100;
linhaTotalNova[COL_PCT_ACU] = '';
linhaTotalNova[COL_CLASSE]  = '';
novaData.push(linhaTotalNova);

// Converter de volta para worksheet
const novaWs = XLSX.utils.aoa_to_sheet(novaData);

// Formatação: definir largura das colunas
novaWs['!cols'] = [
  { wch: 12 },  // Código
  { wch: 55 },  // Material
  { wch: 16 },  // Unidade Medida
  { wch: 14 },  // QUANTIDADE
  { wch: 14 },  // % Individual
  { wch: 14 },  // % Acumulada
  { wch: 14 },  // Classificação
];

// Substituir a aba no workbook
wb.Sheets[SHEET_NAME] = novaWs;

// Salvar o arquivo (sobrescreve o original)
XLSX.writeFile(wb, FILE_PATH);

console.log(`\n✅ Arquivo atualizado com sucesso: ${FILE_PATH}`);
console.log(`   Colunas adicionadas na aba "${SHEET_NAME}": "% Individual", "% Acumulada", "Classificação"`);
console.log(`   Dados ordenados por quantidade decrescente (Pareto)`);
