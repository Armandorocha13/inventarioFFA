import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    console.log(`Recebido arquivo: ${file.name}, tamanho: ${file.size} bytes`);
    const buffer = Buffer.from(await file.arrayBuffer());

    console.log("Fazendo parse do arquivo Excel...");
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.includes('SINAPSE') ? 'SINAPSE' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Ler como array de arrays (2D)
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    console.log(`Total de linhas lidas no Excel (bruto): ${rows.length}`);

    const dataRows: any[] = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const tipoSaldo = row[0] ? String(row[0]).trim() : '';
      if (tipoSaldo === 'Tipo Saldo' || tipoSaldo === '') continue;

      const grupo = row[1] ? String(row[1]).trim() : '';
      const codmat = row[2] ? String(row[2]).trim() : '';
      if (!grupo || !codmat) continue;

      // Extrair o código do grupo (número antes da barra, ex: "34/CLARO PETROPOLIS" -> "34")
      const match = grupo.match(/^(\d+)\//);
      const grupoCodigo = match ? match[1] : '';

      const descricao = row[3] ? String(row[3]).trim() : '';
      const descricaoAuxiliar = row[4] ? String(row[4]).trim() : null;
      const unid = row[5] ? String(row[5]).trim() : '';
      const codcpl = row[6] ? String(row[6]).trim() : '';
      // row[7] é Cód. Mat. Auxiliar (ignorado no banco original)
      const codCplAuxiliar = row[8] ? String(row[8]).trim() : null;

      const parseNumber = (val: any) => {
        if (val === undefined || val === null) return 0;
        const clean = String(val).replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 0 : parsed;
      };

      const saldoEstoque = parseNumber(row[9]);
      const progRm = parseNumber(row[10]);
      const progTm = parseNumber(row[11]);
      const saldoDisponivel = parseNumber(row[12]);
      const valor = parseNumber(row[13]);

      const codGrupoMaterial = row[14] ? String(row[14]).trim() : null;
      const grupoMaterial = row[15] ? String(row[15]).trim() : null;

      dataRows.push({
        tipoSaldo,
        grupoCodigo,
        grupo,
        codmat,
        descricao,
        descricaoAuxiliar,
        unid,
        codcpl,
        codCplAuxiliar,
        saldoEstoque,
        progRm,
        progTm,
        saldoDisponivel,
        valor,
        codGrupoMaterial,
        grupoMaterial,
      });
    }

    console.log(`Total de linhas processadas e tratadas: ${dataRows.length}`);

    if (dataRows.length === 0) {
      return NextResponse.json({ error: 'Nenhum registro válido encontrado na planilha.' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      console.log("Limpando a tabela saldo_estoque...");
      await client.query('TRUNCATE saldo_estoque RESTART IDENTITY CASCADE');

      // Preparando arrays para inserção bulk via UNNEST
      const tipoSaldos = dataRows.map(r => r.tipoSaldo);
      const grupoCodigos = dataRows.map(r => r.grupoCodigo);
      const grupos = dataRows.map(r => r.grupo);
      const codmats = dataRows.map(r => r.codmat);
      const descricoes = dataRows.map(r => r.descricao);
      const descricaoAuxiliares = dataRows.map(r => r.descricaoAuxiliar);
      const unids = dataRows.map(r => r.unid);
      const codcpls = dataRows.map(r => r.codcpl);
      const codCplAuxiliares = dataRows.map(r => r.codCplAuxiliar);
      const saldoEstoques = dataRows.map(r => r.saldoEstoque);
      const progRms = dataRows.map(r => r.progRm);
      const progTms = dataRows.map(r => r.progTm);
      const saldoDisponiveis = dataRows.map(r => r.saldoDisponivel);
      const valores = dataRows.map(r => r.valor);
      const codGrupoMateriais = dataRows.map(r => r.codGrupoMaterial);
      const grupoMateriais = dataRows.map(r => r.grupoMaterial);

      console.log("Executando inserção em lote...");
      const insertQuery = `
        INSERT INTO saldo_estoque (
          tipo_saldo, grupo_codigo, grupo, codmat, descricao, descricao_auxiliar,
          unid, codcpl, cod_cpl_auxiliar, saldo_estoque, prog_rm, prog_tm,
          saldo_disponivel, valor, cod_grupo_material, grupo_material
        )
        SELECT * FROM UNNEST(
          $1::VARCHAR[], $2::VARCHAR[], $3::VARCHAR[], $4::VARCHAR[], $5::VARCHAR[], $6::VARCHAR[],
          $7::VARCHAR[], $8::VARCHAR[], $9::VARCHAR[], $10::NUMERIC[], $11::NUMERIC[], $12::NUMERIC[],
          $13::NUMERIC[], $14::NUMERIC[], $15::VARCHAR[], $16::VARCHAR[]
        )
      `;

      await client.query(insertQuery, [
        tipoSaldos, grupoCodigos, grupos, codmats, descricoes, descricaoAuxiliares,
        unids, codcpls, codCplAuxiliares, saldoEstoques, progRms, progTms,
        saldoDisponiveis, valores, codGrupoMateriais, grupoMateriais
      ]);

      console.log("Sincronizando contagens de progresso_contagem...");
      const syncQuery = `
        UPDATE saldo_estoque se
        SET saldo_disponivel = pc.quantidade_contada
        FROM progresso_contagem pc
        WHERE se.codmat = pc.codmat AND se.grupo = pc.grupo
      `;
      const syncResult = await client.query(syncQuery);
      console.log(`Contagens sincronizadas: ${syncResult.rowCount} registros atualizados.`);

      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        message: 'Tabela saldo_estoque atualizada com sucesso!',
        insertedCount: dataRows.length,
        syncedCount: syncResult.rowCount,
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('❌ Erro na transação do banco:', err);
      return NextResponse.json({ error: `Erro no processamento do banco: ${err.message}` }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('❌ Erro no endpoint GET /api/upload-saldo:', err);
    return NextResponse.json({ error: `Erro no servidor: ${err.message}` }, { status: 500 });
  }
}
