import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar o parser JSON
app.use(express.json());

// Habilitar CORS para o desenvolvimento local integrado com o Vite
app.use(cors());

// Configurar o Pool de conexões do PostgreSQL (Neon Serverless DB)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Inicializar e garantir a existência do schema de histórico ao subir o servidor
async function inicializarBanco() {
  const client = await pool.connect();
  try {
    console.log('🏗️ Garantindo a tabela de histórico "historico_contagem" no Neon...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS historico_contagem (
        id SERIAL PRIMARY KEY,
        codmat VARCHAR(100),
        descricao VARCHAR(255),
        valor_anterior NUMERIC(15, 4),
        valor_novo NUMERIC(15, 4),
        observacao VARCHAR(500),
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Tabela "historico_contagem" validada com sucesso!');
  } catch (err) {
    console.error('❌ Erro ao inicializar a tabela de histórico:', err.message);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/filtros
 * Busca e retorna as UFs ativas e seus Almoxarifados (cidades e contratos) do De-Para.
 */
app.get('/api/filtros', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT cidade, contrato, projeto 
      FROM de_para_projeto 
      ORDER BY cidade ASC, contrato ASC
    `;
    const result = await pool.query(query);

    const estadosMap = new Map();
    const almoxarifados = {};

    result.rows.forEach(row => {
      const cidade = row.cidade ? row.cidade.trim() : '';
      const contrato = row.contrato;
      const projeto = row.projeto ? row.projeto.trim() : '';

      if (!cidade || !contrato) return;

      // Classificação dinâmica de UFs baseado nas cidades do De-Para
      let ufSigla = 'RJ';
      let ufNome = 'Rio de Janeiro';

      if (cidade === 'ESPIRITO SANTO') {
        ufSigla = 'ES';
        ufNome = 'Espírito Santo';
      } else if (cidade === 'SÃO PAULO') {
        ufSigla = 'SP';
        ufNome = 'São Paulo';
      } else if (cidade === 'CURITIBA') {
        ufSigla = 'PR';
        ufNome = 'Paraná';
      } else if (cidade === 'MINAS GERAIS') {
        ufSigla = 'MG';
        ufNome = 'Minas Gerais';
      }

      if (!estadosMap.has(ufSigla)) {
        estadosMap.set(ufSigla, { sigla: ufSigla, nome: ufNome });
      }

      if (!almoxarifados[ufSigla]) {
        almoxarifados[ufSigla] = [];
      }

      almoxarifados[ufSigla].push({
        codigo: `${cidade}|${contrato}`,
        label: `${cidade} - CONTRATO: ${contrato}`,
        cidade,
        contrato
      });
    });

    const estados = Array.from(estadosMap.values());

    res.json({
      estados,
      almoxarifados
    });
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/filtros:', err);
    res.status(500).json({ error: 'Erro ao buscar filtros no banco de dados' });
  }
});

/**
 * GET /api/materiais
 * Carrega e retorna os materiais formatados para um determinado almoxarifado (cidade e contrato),
 * executando o JOIN relacional exato (CAST(se.grupo_codigo AS INTEGER) = dp.contrato).
 */
app.get('/api/materiais', async (req, res) => {
  const { cidade, contrato } = req.query;

  try {
    let query = '';
    let params = [];

    // Se for solicitado "todos" os almoxarifados ou sem filtros
    if (!cidade || cidade === 'todos' || !contrato || contrato === 'todos') {
      query = `
        SELECT 
          se.id,
          dp.cidade AS origem,
          se.codmat,
          se.descricao,
          se.unid AS unidade,
          se.saldo_disponivel AS "saldoAtual",
          se.valor AS "precoUnitario"
        FROM saldo_estoque se
        JOIN de_para_projeto dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
        ORDER BY se.descricao
      `;
    } else {
      query = `
        SELECT 
          se.id,
          dp.cidade AS origem,
          se.codmat,
          se.descricao,
          se.unid AS unidade,
          se.saldo_disponivel AS "saldoAtual",
          se.valor AS "precoUnitario"
        FROM saldo_estoque se
        JOIN de_para_projeto dp ON CAST(se.grupo_codigo AS INTEGER) = dp.contrato
        WHERE dp.cidade = $1 AND dp.contrato = $2
        ORDER BY se.descricao
      `;
      params = [cidade, parseInt(contrato, 10)];
    }

    const result = await pool.query(query, params);

    // Mapeamento extra de propriedades para a UI para garantir que não haja erros de reatividade
    const materiais = result.rows.map(row => ({
      id: row.id,
      origem: row.origem ? row.origem.trim() : '',
      codmat: row.codmat ? row.codmat.trim() : '',
      descricao: row.descricao ? row.descricao.trim() : '',
      unidade: row.unidade ? row.unidade.trim() : '',
      saldoAtual: row.saldoAtual !== null ? parseFloat(row.saldoAtual) : 0,
      precoUnitario: row.precoUnitario !== null ? parseFloat(row.precoUnitario) : 0,
      ultimaAtualizacao: new Date().toISOString()
    }));

    res.json(materiais);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/materiais:', err);
    res.status(500).json({ error: 'Erro ao buscar materiais no banco de dados' });
  }
});

/**
 * GET /api/historico
 * Retorna o histórico de auditorias gravadas no banco de dados Neon para exibição na aba de Monitoramento.
 */
app.get('/api/historico', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        codmat,
        descricao,
        valor_anterior AS "valorAnterior",
        valor_novo AS "valorNovo",
        (valor_novo - valor_anterior) AS desvio,
        observacao,
        timestamp
      FROM historico_contagem
      ORDER BY timestamp DESC
      LIMIT 100
    `;
    const result = await pool.query(query);
    
    // Garantir formatação numérica correta
    const historico = result.rows.map(row => ({
      id: row.id,
      codmat: row.codmat ? row.codmat.trim() : '',
      descricao: row.descricao ? row.descricao.trim() : '',
      valorAnterior: row.valorAnterior !== null ? parseFloat(row.valorAnterior) : null,
      valorNovo: row.valorNovo !== null ? parseFloat(row.valorNovo) : 0,
      desvio: row.desvio !== null ? parseFloat(row.desvio) : 0,
      observacao: row.observacao ? row.observacao.trim() : null,
      timestamp: row.timestamp
    }));

    res.json(historico);
  } catch (err) {
    console.error('❌ Erro no endpoint GET /api/historico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de auditorias no banco' });
  }
});

/**
 * POST /api/contagem
 * Recebe o lote de contagens físicas, realiza a transação relacional gravando
 * os logs no histórico de contagens e atualizando as colunas de saldo_disponivel no estoque.
 */
app.post('/api/contagem', async (req, res) => {
  const contagens = req.body; // Espera array de contagens: [{ id, codmat, descricao, valorAnterior, valorNovo, observacao }]

  if (!Array.isArray(contagens) || contagens.length === 0) {
    return res.status(400).json({ error: 'Corpo da requisição deve ser um array válido de contagens.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of contagens) {
      const { id, codmat, descricao, valorAnterior, valorNovo, observacao } = item;

      // 1. Inserir log do histórico de contagem
      const insertHistQuery = `
        INSERT INTO historico_contagem (codmat, descricao, valor_anterior, valor_novo, observacao)
        VALUES ($1, $2, $3, $4, $5)
      `;
      await client.query(insertHistQuery, [
        codmat,
        descricao,
        valorAnterior !== undefined && valorAnterior !== null ? parseFloat(valorAnterior) : null,
        parseFloat(valorNovo),
        observacao || null
      ]);

      // 2. Atualizar saldo_disponivel (estoque) na tabela de materiais
      const updateStockQuery = `
        UPDATE saldo_estoque 
        SET saldo_disponivel = $1 
        WHERE id = $2
      `;
      await client.query(updateStockQuery, [parseFloat(valorNovo), parseInt(id, 10)]);
    }

    await client.query('COMMIT');
    res.json({ success: true, count: contagens.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao gravar contagens e atualizar estoque:', err);
    res.status(500).json({ error: 'Erro ao gravar as contagens físicas no banco de dados.' });
  } finally {
    client.release();
  }
});

// Inicializar e rodar o servidor
inicializarBanco().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor de API do SGI ativo na porta ${PORT}!`);
    console.log(`🔌 Conectado ao Neon DB.`);
  });
});
