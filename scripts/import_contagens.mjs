import path from 'node:path';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { abrirBanco } from './_db.mjs';

function normalizeCity(city) {
  if (!city) return '';
  const upper = city.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (upper === 'GOVERNADOR VALADARES') return 'VALADARES';
  if (upper === 'VITORIA') return 'ESPIRITO SANTO';
  return upper;
}

function obterContrato(estado, categoria) {
  const est = String(estado || '').trim().toUpperCase();
  const cat = String(categoria || '').trim().toUpperCase();
  
  if (est === 'ES') {
    return cat === 'SSO' ? 62 : 61;
  }
  if (est === 'SP') {
    return cat === 'SSO' ? 31 : 31; // Default SP new items to contract 31 as it's the primary one
  }
  if (est === 'MG') {
    return cat === 'SSO' ? 59 : 58;
  }
  if (est === 'PR') {
    return cat === 'SSO' ? 72 : 71;
  }
  // Default to RJ
  return cat === 'SSO' ? 41 : 21;
}

function obterProjetoDefault(cidadeNorm, contrato) {
  if (cidadeNorm === 'RIO DE JANEIRO') {
    return contrato === 21 ? 'FERRAM. REG. RJ' : 'REG SSO';
  }
  if (cidadeNorm === 'SAO PAULO' || cidadeNorm === 'SÃO PAULO') {
    return contrato === 31 ? 'FERRAMENTARIA SP 31' : 'SEGUNRANÇA D TRABALHO';
  }
  if (cidadeNorm === 'ESPIRITO SANTO') {
    return contrato === 61 ? 'FERRAMENTAL VITÓRIA' : 'SSO ES';
  }
  if (cidadeNorm === 'CURITIBA') {
    return contrato === 71 ? 'CLARO IAT - PR' : 'SSO - CLARO IAT - PR';
  }
  if (cidadeNorm === 'BELO HORIZONTE') {
    return contrato === 58 ? 'FERRAMENTAL BH' : 'SSO BELO HORIZONTE';
  }
  if (cidadeNorm === 'JUIZ DE FORA') {
    return contrato === 58 ? 'FERRAMENTAL JUIZ DE' : 'SSO JUIZ DE FORA';
  }
  if (cidadeNorm === 'UBERLANDIA') {
    return contrato === 58 ? 'FERRAM. UBERLÂNDIA' : 'SSO UBERLÂNDIA';
  }
  if (cidadeNorm === 'VALADARES') {
    return contrato === 58 ? 'FERRAMENTAL GOV VALA' : 'SSO GOV. VALADARES';
  }
  if (cidadeNorm === 'VARGINHA') {
    return contrato === 58 ? 'FERRAMENTAL VARGINHA' : 'SSO VARGINHA';
  }
  return null;
}

export function importContagens() {
  const planilhaNome = 'armando.xlsx';
  const planilhaPath = path.join(process.cwd(), 'docs', 'planilhas', planilhaNome);

  if (!fs.existsSync(planilhaPath)) {
    throw new Error(`Planilha não encontrada: docs/planilhas/${planilhaNome}`);
  }

  const db = abrirBanco();
  console.log('Carregando planilha armando.xlsx aba CONTAGEM...');
  const wb = XLSX.readFile(planilhaPath);
  const sheet = wb.Sheets['CONTAGEM'];
  if (!sheet) {
    throw new Error('Aba CONTAGEM não encontrada no arquivo armando.xlsx');
  }

  const rows = XLSX.utils.sheet_to_json(sheet);
  console.log(`Encontradas ${rows.length} linhas para processar.`);

  // Load all current materials in DB
  const dbMaterials = db.prepare('SELECT id, codmat, origem, contrato, grupo, saldoAtual FROM vw_estoque_contagem').all();
  
  // Queries
  const findProjetos = db.prepare('SELECT projeto FROM de_para_projeto WHERE cidade = ? AND contrato = ?');
  const insertMaterial = db.prepare(`
    INSERT INTO saldo_estoque (
      data, origem, contrato, grupo, codmat, descricao, unidade,
      saldo_estoque, saldo_disponivel, valor, total_real, classe_abc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertContagem = db.prepare(`
    INSERT INTO progresso_contagem (cidade, grupo, codmat, quantidade_contada, atualizado_em)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cidade, grupo, codmat) DO UPDATE SET
      quantidade_contada = excluded.quantidade_contada,
      atualizado_em = excluded.atualizado_em
  `);

  let countSucesso = 0;
  let countNovos = 0;
  let countMultiplos = 0;

  db.transaction(() => {
    for (const r of rows) {
      const estado = String(r.Estado || '').trim().toUpperCase();
      const cidadeExcel = String(r.Cidade || '').trim();
      const cidadeNorm = normalizeCity(cidadeExcel);
      const cat = String(r.Categoria || '').trim().toUpperCase();
      const codmat = String(r['Código'] || '').trim();
      const desc = String(r['Descrição'] || '').trim();
      const unid = String(r['Unidade'] || '').trim();
      const qtdFisica = r.Quantidade !== undefined && r.Quantidade !== null ? Number(r.Quantidade) : null;
      const excelSaldo = Number(r['Saldo em Estoque'] ?? 0);
      const classeAbc = String(r['Curva ABC'] || 'C').trim().toUpperCase();
      const valorUnit = Number(r['Valor Unitário'] ?? 0);

      if (!cidadeNorm || !codmat) continue;

      const contrato = obterContrato(estado, cat);

      // Find candidates in current DB
      let candidates = dbMaterials.filter(m => {
        if (m.codmat !== codmat) return false;
        
        const dbOrigem = normalizeCity(m.origem);
        let matchCity = dbOrigem === cidadeNorm;
        if (!matchCity) {
          // Fallbacks for SP & Curitiba naming
          if (dbOrigem === 'SAO PAULO' && cidadeNorm === 'SAO PAULO') matchCity = true;
          if (dbOrigem === 'CURITIBA' && cidadeNorm === 'CURITIBA') matchCity = true;
        }
        if (!matchCity) return false;

        let mCat = 'SSO';
        const grupoUpper = (m.grupo || '').toUpperCase();
        if (grupoUpper.includes('FERRAMENTARIA') || grupoUpper.includes('FERRAMENTAL') || m.contrato === 21 || m.contrato === 58 || m.contrato === 61 || m.contrato === 71 || m.contrato === 1 || m.contrato === 31) {
          if (m.contrato === 1 || m.contrato === 31) {
            mCat = grupoUpper.includes('FERRAMENTARIA') ? 'FERRAMENTARIA' : 'SSO';
          } else {
            mCat = 'FERRAMENTARIA';
          }
        }
        return mCat === cat;
      });

      let matchedMaterialId = null;
      let matchedMaterialObj = null;

      if (candidates.length === 1) {
        matchedMaterialObj = candidates[0];
        matchedMaterialId = matchedMaterialObj.id;
      } else if (candidates.length > 1) {
        // Resolve by Saldo match
        const bySaldo = candidates.filter(c => Math.abs(c.saldoAtual - excelSaldo) < 0.01);
        if (bySaldo.length === 1) {
          matchedMaterialObj = bySaldo[0];
          matchedMaterialId = matchedMaterialObj.id;
        } else {
          // Default to regular project for this city + contract
          const defProj = obterProjetoDefault(cidadeNorm, contrato);
          const matchedByProj = candidates.find(c => c.grupo === defProj);
          if (matchedByProj) {
            matchedMaterialObj = matchedByProj;
            matchedMaterialId = matchedByProj.id;
          } else {
            // Default to first candidate
            matchedMaterialObj = candidates[0];
            matchedMaterialId = matchedMaterialObj.id;
          }
          countMultiplos++;
        }
      } else {
        // New item - insert into saldo_estoque
        // 1. Resolve project name
        let projetoName = obterProjetoDefault(cidadeNorm, contrato);
        if (!projetoName) {
          const dbProjs = findProjetos.all(cidadeNorm, contrato);
          if (dbProjs.length > 0) {
            projetoName = dbProjs[0].projeto;
          } else {
            projetoName = cat === 'SSO' ? `SSO ${cidadeExcel.toUpperCase()}` : `FERRAMENTAL ${cidadeExcel.toUpperCase()}`;
          }
        }

        // Insere em saldo_estoque com saldo 0
        const res = insertMaterial.run(
          new Date().toISOString().slice(0, 10),
          cidadeNorm,
          contrato,
          projetoName,
          codmat,
          desc,
          unid,
          0, // saldo_estoque
          0, // saldo_disponivel
          valorUnit,
          0, // total_real
          classeAbc
        );
        
        matchedMaterialId = res.lastInsertRowid;
        matchedMaterialObj = {
          id: matchedMaterialId,
          codmat,
          origem: cidadeNorm,
          contrato,
          grupo: projetoName,
          saldoAtual: 0
        };
        
        // Push this new material to local dbMaterials so future rows of same item can match it
        dbMaterials.push(matchedMaterialObj);
        
        countNovos++;
      }

      if (matchedMaterialObj && qtdFisica !== null) {
        insertContagem.run(matchedMaterialObj.origem, matchedMaterialObj.grupo, matchedMaterialObj.codmat, qtdFisica, new Date().toISOString());
        countSucesso++;
      }
    }
  })();

  db.close();
  console.log(`Importação concluída:`);
  console.log(`- ${countSucesso} contagens inseridas/atualizadas com sucesso.`);
  console.log(`- ${countNovos} novos materiais inseridos no cadastro com saldo 0.`);
  console.log(`- ${countMultiplos} resoluções de múltiplos projetos resolvidas pelo projeto padrão.`);
}

importContagens();
