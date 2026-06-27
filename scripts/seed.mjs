// Popula o banco SQLite a partir da planilha consolidado estoque inventario.xlsx:
//   - de_para_projeto  ← extraído dinamicamente das bases/projetos
//   - saldo_estoque    ← aba CONSOLIDADO (ou primeira aba)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { abrirBanco, PLANILHAS_DIR } from './_db.mjs';

function parseNumero(val) {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return Number.isNaN(parsed) ? 0 : parsed;
}

const str = (v) => (v ? String(v).trim() : '');

/** Mapeia a Base e Projeto para o contrato autorizado correspondente. */
export function obterContratoEOrigem(base, projeto) {
  const baseUpper = str(base).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const projUpper = str(projeto).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let cidade = str(base);
  let contrato = 21; // fallback default (RJ Ferramentaria)

  // 1. ESPÍRITO SANTO
  if (baseUpper === 'ESPIRITO SANTO') {
    cidade = 'ESPIRITO SANTO';
    contrato = projUpper.includes('SSO') ? 62 : 61;
  }
  // 2. SÃO PAULO
  else if (baseUpper === 'SAO PAULO') {
    cidade = 'SÃO PAULO';
    if (projUpper.includes('31') || projUpper.includes('SEGUNRANCA')) {
      contrato = 31;
    } else {
      contrato = 1;
    }
  }
  // 3. MINAS GERAIS (Bases individuais)
  else if (['UBERLANDIA', 'VALADARES', 'BELO HORIZONTE', 'JUIZ DE FORA', 'VARGINHA'].includes(baseUpper)) {
    contrato = (projUpper.includes('SSO') || projUpper.includes('SEG')) ? 59 : 58;
  }
  // 4. PARANÁ / CURITIBA
  else if (baseUpper === 'CURITIBA' || baseUpper === 'PARANA') {
    cidade = 'CURITIBA';
    contrato = projUpper.includes('SSO') ? 72 : 71;
  }
  // 5. RIO DE JANEIRO e bases da região (Lagos, Niterói, Campos, Petrópolis, Teresópolis, Friburgo, Olaria)
  else {
    if (projUpper.includes('SEG') || projUpper.includes('SSO') || projUpper.includes('REG SSO')) {
      contrato = 41;
    } else {
      contrato = 21;
    }
  }

  return { contrato, cidade };
}

export function seed() {
  const planilhaNome = 'consolidado estoque inventario.xlsx';
  const planilhaPath = path.join(PLANILHAS_DIR, planilhaNome);

  if (!fs.existsSync(planilhaPath)) {
    throw new Error(`Planilha não encontrada: docs/planilhas/${planilhaNome}`);
  }

  const db = abrirBanco();

  // Limpa tabelas antes de popular
  db.exec(`
    DELETE FROM saldo_estoque;
    DELETE FROM de_para_projeto;
    DELETE FROM sqlite_sequence WHERE name IN ('saldo_estoque', 'de_para_projeto');
  `);

  console.log('Lendo planilha de estoque...');
  const wb = XLSX.readFile(planilhaPath);
  const sheetName = wb.SheetNames.includes('CONSOLIDADO') ? 'CONSOLIDADO' : wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

  const insertSaldo = db.prepare(`
    INSERT INTO saldo_estoque (
      data, origem, contrato, grupo, codmat, descricao, unidade,
      saldo_estoque, saldo_disponivel, valor, total_real, classe_abc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProjeto = db.prepare(`
    INSERT INTO de_para_projeto (contrato, cidade, projeto)
    VALUES (?, ?, ?)
  `);

  const deParaProjetosUnicos = new Map(); // chave: "contrato|cidade|projeto"
  let saldoCount = 0;

  db.transaction(() => {
    for (const r of rows) {
      const base = str(r['Base'] ?? r['Base '] ?? r['Cidade'] ?? r['BASE']);
      const projeto = str(r['Projeto']);
      const codmat = str(r['Código'] ?? r['Codigo']);
      
      if (!base || !projeto || !codmat) continue;

      const { contrato, cidade } = obterContratoEOrigem(base, projeto);

      const dataStr = str(r['Data']);
      const descricao = str(r['Descrição'] ?? r['Descricao']);
      const unidade = str(r['Unidade'] ?? r['Unid'] ?? r['Unidade ']);
      const saldo = parseNumero(r['Saldo']);
      const valor = parseNumero(r['Valor Unitario'] ?? r['Valor Unitário'] ?? r['Valor']);
      const totalReal = parseNumero(r['Total Real'] ?? (saldo * valor));
      const classeAbc = str(r['Classe ABC'] ?? r['ClasseABC'] ?? r['Classe']);

      // Insere o material em saldo_estoque
      insertSaldo.run(
        dataStr,
        cidade,
        contrato,
        projeto,
        codmat,
        descricao,
        unidade,
        saldo,
        saldo, // saldo_disponivel inicializa com saldo_estoque
        valor,
        totalReal,
        classeAbc
      );
      saldoCount++;

      // Registra o projeto para tabela de_para_projeto de filtros
      const key = `${contrato}|${cidade}|${projeto}`;
      if (!deParaProjetosUnicos.has(key)) {
        deParaProjetosUnicos.set(key, { contrato, cidade, projeto });
      }
    }

    // Insere os de_para_projeto únicos
    for (const p of deParaProjetosUnicos.values()) {
      insertProjeto.run(p.contrato, p.cidade, p.projeto);
    }
  })();

  db.close();
  console.log(`✓ saldo_estoque: ${saldoCount} linhas inseridas`);
  console.log(`✓ de_para_projeto: ${deParaProjetosUnicos.size} projetos inseridos`);
  console.log('Seed concluído com sucesso!');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed();
}
