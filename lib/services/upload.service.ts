/**
 * Importação de saldo de estoque a partir de planilha Excel (aba SINAPSE).
 * Faz parse, TRUNCATE + bulk insert em `saldo_estoque` e re-sincroniza as
 * contagens já registradas em `progresso_contagem`.
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
  tipoSaldo: string;
  grupoCodigo: string;
  grupo: string;
  codmat: string;
  descricao: string;
  descricaoAuxiliar: string | null;
  unid: string;
  codcpl: string;
  codCplAuxiliar: string | null;
  saldoEstoque: number;
  progRm: number;
  progTm: number;
  saldoDisponivel: number;
  valor: number;
  codGrupoMaterial: string | null;
  grupoMaterial: string | null;
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

function strOrNull(val: unknown): string | null {
  return val ? String(val).trim() : null;
}

export function parsePlanilha(buffer: Buffer): LinhaSaldo[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames.includes('SINAPSE') ? 'SINAPSE' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  const dataRows: LinhaSaldo[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const tipoSaldo = str(row[0]);
    if (tipoSaldo === 'Tipo Saldo' || tipoSaldo === '') continue;

    const grupo = str(row[1]);
    const codmat = str(row[2]);
    if (!grupo || !codmat) continue;

    const match = grupo.match(/^(\d+)\//);
    const grupoCodigo = match ? match[1] : '';

    dataRows.push({
      tipoSaldo,
      grupoCodigo,
      grupo,
      codmat,
      descricao: str(row[3]),
      descricaoAuxiliar: strOrNull(row[4]),
      unid: str(row[5]),
      codcpl: str(row[6]),
      codCplAuxiliar: strOrNull(row[8]),
      saldoEstoque: parseNumero(row[9]),
      progRm: parseNumero(row[10]),
      progTm: parseNumero(row[11]),
      saldoDisponivel: parseNumero(row[12]),
      valor: parseNumero(row[13]),
      codGrupoMaterial: strOrNull(row[14]),
      grupoMaterial: strOrNull(row[15]),
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
    await tx.query('TRUNCATE saldo_estoque RESTART IDENTITY CASCADE');

    const cols = (k: keyof LinhaSaldo) => dataRows.map((r) => r[k]);

    await tx.query(
      `INSERT INTO saldo_estoque (
         tipo_saldo, grupo_codigo, grupo, codmat, descricao, descricao_auxiliar,
         unid, codcpl, cod_cpl_auxiliar, saldo_estoque, prog_rm, prog_tm,
         saldo_disponivel, valor, cod_grupo_material, grupo_material
       )
       SELECT * FROM UNNEST(
         $1::VARCHAR[], $2::VARCHAR[], $3::VARCHAR[], $4::VARCHAR[], $5::VARCHAR[], $6::VARCHAR[],
         $7::VARCHAR[], $8::VARCHAR[], $9::VARCHAR[], $10::NUMERIC[], $11::NUMERIC[], $12::NUMERIC[],
         $13::NUMERIC[], $14::NUMERIC[], $15::VARCHAR[], $16::VARCHAR[]
       )`,
      [
        cols('tipoSaldo'), cols('grupoCodigo'), cols('grupo'), cols('codmat'),
        cols('descricao'), cols('descricaoAuxiliar'), cols('unid'), cols('codcpl'),
        cols('codCplAuxiliar'), cols('saldoEstoque'), cols('progRm'), cols('progTm'),
        cols('saldoDisponivel'), cols('valor'), cols('codGrupoMaterial'), cols('grupoMaterial'),
      ] as never,
    );

    const sync = await tx.query(
      `UPDATE saldo_estoque se
          SET saldo_disponivel = pc.quantidade_contada
         FROM progresso_contagem pc
        WHERE se.codmat = pc.codmat AND se.grupo = pc.grupo`
    );

    return { insertedCount: dataRows.length, syncedCount: sync.rowCount };
  });
}
