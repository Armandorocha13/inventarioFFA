/**
 * Importação de saldo de estoque a partir de planilha Excel consolidada.
 * Faz parse, TRUNCATE/DELETE + bulk insert em `saldo_estoque` e `de_para_projeto`
 * e re-sincroniza as contagens já registradas em `progresso_contagem`.
 */
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export class UploadInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadInvalidoError';
  }
}

interface LinhaSaldo {
  data: string;
  origem: string;
  contrato: number;
  grupo: string;
  codmat: string;
  descricao: string;
  unidade: string;
  saldoEstoque: number;
  saldoDisponivel: number;
  valor: number;
  totalReal: number;
  classeAbc: string;
}

function parseNumero(val: unknown): number {
  if (val === undefined || val === null) return 0;
  const clean = String(val).replace(/\s/g, '').replace(',', '.');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

function str(val: unknown): string {
  return val ? String(val).trim() : '';
}

/** Mapeia a Base e Projeto para o contrato autorizado correspondente. */
function obterContratoEOrigem(base: string, projeto: string): { contrato: number; cidade: string } {
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

export function parsePlanilha(buffer: Buffer): LinhaSaldo[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.includes('CONSOLIDADO') ? 'CONSOLIDADO' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (rows.length === 0) return [];

  const headers = rows[0] as unknown[];
  const idxData = headers.findIndex((h) => str(h).toLowerCase().startsWith('data'));
  const idxBase = headers.findIndex((h) => {
    const s = str(h).toLowerCase();
    return s.startsWith('base') || s.startsWith('cidade');
  });
  const idxProjeto = headers.findIndex((h) => str(h).toLowerCase().startsWith('projeto'));
  const idxCodigo = headers.findIndex((h) => str(h).toLowerCase().startsWith('cod'));
  const idxDescricao = headers.findIndex((h) => str(h).toLowerCase().startsWith('desc'));
  const idxUnidade = headers.findIndex((h) => str(h).toLowerCase().startsWith('uni'));
  const idxValor = headers.findIndex((h) => {
    const s = str(h).toLowerCase();
    return s.startsWith('valor') || s.startsWith('preco');
  });
  const idxSaldo = headers.findIndex((h) => str(h).toLowerCase().startsWith('saldo'));
  const idxTotal = headers.findIndex((h) => {
    const s = str(h).toLowerCase();
    return s.startsWith('total') || s.includes('real');
  });
  const idxClasse = headers.findIndex((h) => {
    const s = str(h).toLowerCase();
    return s.startsWith('classe') || s.includes('abc');
  });

  const dataRows: LinhaSaldo[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const base = idxBase !== -1 ? str(row[idxBase]) : '';
    const projeto = idxProjeto !== -1 ? str(row[idxProjeto]) : '';
    const codmat = idxCodigo !== -1 ? str(row[idxCodigo]) : '';
    if (!base || !projeto || !codmat) continue;

    const { contrato, cidade } = obterContratoEOrigem(base, projeto);

    const dataStr = idxData !== -1 ? str(row[idxData]) : '';
    const descricao = idxDescricao !== -1 ? str(row[idxDescricao]) : '';
    const unidade = idxUnidade !== -1 ? str(row[idxUnidade]) : '';
    const saldoEstoque = idxSaldo !== -1 ? parseNumero(row[idxSaldo]) : 0;
    const valor = idxValor !== -1 ? parseNumero(row[idxValor]) : 0;
    const totalReal = idxTotal !== -1 ? parseNumero(row[idxTotal]) : (saldoEstoque * valor);
    const classeAbc = idxClasse !== -1 ? str(row[idxClasse]) : '';

    dataRows.push({
      data: dataStr,
      origem: cidade,
      contrato,
      grupo: projeto,
      codmat,
      descricao,
      unidade,
      saldoEstoque,
      saldoDisponivel: saldoEstoque,
      valor,
      totalReal,
      classeAbc,
    });
  }

  return dataRows;
}

export interface UploadResult {
  insertedCount: number;
  syncedCount: number;
}

export async function importarSaldo(buffer: Buffer): Promise<UploadResult> {
  const dataRows = parsePlanilha(buffer);

  if (dataRows.length === 0) {
    throw new UploadInvalidoError('Nenhum registro válido encontrado na planilha.');
  }

  return db.transaction(async (tx) => {
    // 1. Limpa as tabelas de estoque e de projetos (para filtros)
    if (db.dialect === 'pg') {
      await tx.query('TRUNCATE saldo_estoque RESTART IDENTITY CASCADE');
      await tx.query('TRUNCATE de_para_projeto RESTART IDENTITY CASCADE');
    } else {
      await tx.query('DELETE FROM saldo_estoque');
      await tx.query(`DELETE FROM sqlite_sequence WHERE name = 'saldo_estoque'`);
      await tx.query('DELETE FROM de_para_projeto');
      await tx.query(`DELETE FROM sqlite_sequence WHERE name = 'de_para_projeto'`);
    }

    // 2. Insere os novos dados em saldo_estoque
    if (db.dialect === 'pg') {
      const cols = (k: keyof LinhaSaldo) => dataRows.map((r) => r[k]);
      await tx.query(
        `INSERT INTO saldo_estoque (
           data, origem, contrato, grupo, codmat, descricao,
           unidade, saldo_estoque, saldo_disponivel, valor, total_real, classe_abc
         )
         SELECT * FROM UNNEST(
           $1::VARCHAR[], $2::VARCHAR[], $3::INTEGER[], $4::VARCHAR[], $5::VARCHAR[], $6::VARCHAR[],
           $7::VARCHAR[], $8::NUMERIC[], $9::NUMERIC[], $10::NUMERIC[], $11::NUMERIC[], $12::VARCHAR[]
         )`,
        [
          cols('data'), cols('origem'), cols('contrato'), cols('grupo'), cols('codmat'), cols('descricao'),
          cols('unidade'), cols('saldoEstoque'), cols('saldoDisponivel'), cols('valor'), cols('totalReal'), cols('classeAbc')
        ] as never,
      );
    } else {
      const insertSql = `
        INSERT INTO saldo_estoque (
          data, origem, contrato, grupo, codmat, descricao,
          unidade, saldo_estoque, saldo_disponivel, valor, total_real, classe_abc
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `;
      for (const r of dataRows) {
        await tx.query(insertSql, [
          r.data, r.origem, r.contrato, r.grupo, r.codmat, r.descricao,
          r.unidade, r.saldoEstoque, r.saldoDisponivel, r.valor, r.totalReal, r.classeAbc,
        ]);
      }
    }

    // 3. Insere os de_para_projeto únicos para os filtros funcionarem dinamicamente
    const uniqueProjects = new Map<string, { contrato: number; cidade: string; projeto: string }>();
    for (const r of dataRows) {
      const key = `${r.contrato}|${r.origem}|${r.grupo}`;
      if (!uniqueProjects.has(key)) {
        uniqueProjects.set(key, { contrato: r.contrato, cidade: r.origem, projeto: r.grupo });
      }
    }

    const insertProjSql = `
      INSERT INTO de_para_projeto (contrato, cidade, projeto) VALUES ($1, $2, $3)
    `;
    for (const p of uniqueProjects.values()) {
      await tx.query(insertProjSql, [p.contrato, p.cidade, p.projeto]);
    }

    // 4. Sincroniza o saldo_disponivel com as contagens físicas em andamento
    const sync = await tx.query(
      `UPDATE saldo_estoque se
          SET saldo_disponivel = pc.quantidade_contada
         FROM progresso_contagem pc
        WHERE se.codmat = pc.codmat AND se.grupo = pc.grupo AND se.origem = pc.cidade`
    );

    return { insertedCount: dataRows.length, syncedCount: sync.rowCount };
  });
}
