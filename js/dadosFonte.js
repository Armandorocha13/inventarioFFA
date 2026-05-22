/**
 * dadosFonte.js — Interface de Integração de Dados do SGI com a API local (Neon DB)
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo gerencia toda a comunicação Ajax/Fetch assíncrona entre o front-end
 * e a API local (porta 3000), mantendo uma fonte local em cache para os filtros.
 */

const API_BASE_URL = 'http://localhost:3000/api';

const FONTE_VAZIA = {
  estados: [],
  almoxarifados: {},
};

let fonteAtual = { ...FONTE_VAZIA };

/**
 * Carrega a estrutura de filtros (UFs e Almoxarifados com Contratos) a partir do Neon DB.
 */
export async function inicializarFiltros() {
  try {
    const response = await fetch(`${API_BASE_URL}/filtros`);
    if (!response.ok) {
      throw new Error(`Erro na requisição dos filtros: status ${response.status}`);
    }
    const data = await response.json();
    fonteAtual.estados = Array.isArray(data?.estados) ? data.estados : [];
    fonteAtual.almoxarifados = data?.almoxarifados && typeof data.almoxarifados === 'object' ? data.almoxarifados : {};
    return true;
  } catch (err) {
    console.error('💥 Erro ao carregar filtros da API:', err);
    throw err;
  }
}

/**
 * Retorna os estados disponíveis no cache local dos filtros.
 */
export function getEstados() {
  return [...fonteAtual.estados];
}

/**
 * Retorna todas as siglas de UF dos estados disponíveis.
 */
export function getTodasUFs() {
  return fonteAtual.estados.map(e => e.sigla);
}

/**
 * Retorna os almoxarifados mapeados para uma determinada UF a partir do cache local.
 */
export function getAlmoxarifados(uf) {
  if (!uf || !fonteAtual.almoxarifados[uf]) return [];
  return [...fonteAtual.almoxarifados[uf]];
}

/**
 * Carrega e retorna a lista de materiais para a cidade e contrato (almoxarifado) especificados.
 * Faz uma requisição assíncrona à API, trazendo a quantidade de estoque da coluna saldo_disponivel
 * e o preço unitário da coluna valor (formatados de forma segura).
 */
export async function buscarMateriais(codigoAlmox) {
  if (!codigoAlmox) return [];
  
  try {
    let url = `${API_BASE_URL}/materiais`;
    if (codigoAlmox !== 'todos') {
      const [cidade, contrato] = codigoAlmox.split('|');
      url = `${API_BASE_URL}/materiais?cidade=${encodeURIComponent(cidade)}&contrato=${encodeURIComponent(contrato)}`;
    } else {
      url = `${API_BASE_URL}/materiais?cidade=todos&contrato=todos`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao buscar materiais: status ${response.status}`);
    }
    
    const materiais = await response.json();
    return materiais;
  } catch (err) {
    console.error(`💥 Erro ao carregar materiais para o almoxarifado "${codigoAlmox}":`, err);
    throw err;
  }
}

/**
 * Consulta o histórico de auditorias registradas no banco de dados Neon.
 */
export async function buscarHistoricoBanco() {
  try {
    const response = await fetch(`${API_BASE_URL}/historico`);
    if (!response.ok) {
      throw new Error(`Erro ao buscar histórico: status ${response.status}`);
    }
    const historico = await response.json();
    return historico;
  } catch (err) {
    console.error('💥 Erro ao carregar o histórico de auditorias da API:', err);
    throw err;
  }
}

/**
 * Envia o lote de contagens físicas realizadas pelo usuário para gravação final no Neon DB.
 */
export async function gravarContagensBanco(contagens) {
  if (!Array.isArray(contagens) || contagens.length === 0) {
    return { success: false, error: 'Lista de contagens está vazia.' };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/contagem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(contagens)
    });

    if (!response.ok) {
      throw new Error(`Erro ao gravar contagens: status ${response.status}`);
    }

    const resData = await response.json();
    return resData;
  } catch (err) {
    console.error('💥 Erro ao gravar as contagens na API:', err);
    throw err;
  }
}
