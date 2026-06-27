/**
 * filtros.ts — Módulo de Filtro, Ordenação e Debounce do SGI
 */
import type { Material, ContagensMap } from './auxiliaresUI';

export interface FiltroState {
  termo: string;
  tipo: string;
  grupo: string;
}

export const ALIAS_CIDADE: Record<string, string> = {
  "BH": "BELO HORIZONTE",
  "GOV VALA": "GOV VALADARES",
  "GOV.VALADARES": "GOV VALADARES",
  "JUIZ DE": "JUIZ DE FORA",
  "VARGINHAS": "VARGINHA",
  // CAMPOS — entradas específicas por nome do grupo
  "IAT CAMPOS": "CAMPOS",
  "CLARO IAT CAMPOS": "CAMPOS",
  "CPS": "CAMPOS",
  "FERRAMENTARIA CPS": "CAMPOS",
  // Rio de Janeiro
  "TIM RJO": "RIO DE JANEIRO",
  "RJO": "RIO DE JANEIRO",
  "FERRAMENTARIA RJO": "RIO DE JANEIRO",
  "SSO RJ": "RIO DE JANEIRO",
  "REG. RJ": "RIO DE JANEIRO",
  "REG.RJ": "RIO DE JANEIRO",
  // Teresópolis
  "CLARO TERESOPOLIS": "TERESOPOLIS",
  "SEG TERESOPOLIS": "TERESOPOLIS",
  "TERESOPOLIS": "TERESOPOLIS",
  // Nova Friburgo — "FERRAM. CLARO IAT" é o nome do grupo contrato 21 para Friburgo
  "FERRAM.CLARO IAT": "NOVA FRIBURGO",
  "FRIBURGO": "NOVA FRIBURGO",
  "N FRIBURGO": "NOVA FRIBURGO",
  "N. FRIBURGO": "NOVA FRIBURGO",
  "NVA FRIBURGO": "NOVA FRIBURGO",
  "N.FRIBURGO": "NOVA FRIBURGO",
  "SEG NOVA FRIBURGO": "NOVA FRIBURGO",
  "REGULADOR FRIBURGO": "NOVA FRIBURGO",

  // Adições para resolver o problema dos filtros de cidade:
  // Paraná / Curitiba
  "- CLARO IAT - PR": "CURITIBA",
  "- LIGGA CTB - PR": "CURITIBA",
  "CURITIBA PR": "CURITIBA",
  "CORRETIVA": "CURITIBA",
  "LIGGA CTB - PR": "CURITIBA",
  "CLARO IAT - PR": "CURITIBA",
  "FERRAM CURITIBA PR": "CURITIBA",
  "71/- CLARO IAT - PR": "CURITIBA",
  "71/- LIGGA CTB - PR": "CURITIBA",
  "71/CORRETIVA": "CURITIBA",
  "71/C.GRANDE": "CURITIBA",
  "72/SSO - LIGGA CTB - PR": "CURITIBA",
  "72/SSO - CLARO IAT - PR": "CURITIBA",
  "71/FERRAM CURITIBA PR": "CURITIBA",

  // São Paulo
  "D TRABALHO": "SAO PAULO",
  "DO TRABALHO SP": "SAO PAULO",
  "SP": "SAO PAULO",
  "SAO PAULO": "SAO PAULO",
  "SÃO PAULO": "SAO PAULO",
  "FERRAMENTARIA SP": "SAO PAULO",
  "31/FERRAMENTARIA SP": "SAO PAULO",
  "01/FERRAMENTARIA SP": "SAO PAULO",
  "01/SP": "SAO PAULO",
  "01/DO TRABALHO SP": "SAO PAULO",
  "31/D TRABALHO": "SAO PAULO",
  "31/SAO PAULO": "SAO PAULO",
  "36/FTTC": "SAO PAULO",
  "36/FTTH": "SAO PAULO",
  "36/REGULADOR": "SAO PAULO",
  "37/REGROUP": "SAO PAULO",
  "37/CLEAN UP": "SAO PAULO",
  "38/ADEQUACAO": "SAO PAULO",
  "38/ALIVIO": "SAO PAULO",
  "37/UP": "SAO PAULO",

  // Campo Grande
  "C.GRANDE": "CAMPO GRANDE",
  "FERRAM. C.GRANDE": "CAMPO GRANDE",
  "21/FERRAM. C.GRANDE": "CAMPO GRANDE",
  
  // Espírito Santo (Vila Velha e Vitória são cidades capixabas válidas)
  "ESPIRITO SANTO": "VITORIA",
  "SSO ES": "VITORIA",
  "FERRAMENTAL VITÓRIA": "VITORIA",
  "VITORIA": "VITORIA",
  "61/ESPIRITO SANTO": "VITORIA",
  "62/SSO ES": "VITORIA",
  "61/FERRAMENTAL VITÓRIA": "VITORIA",
  "64/ESSJC01": "VITORIA",
  "64/535350": "VITORIA",
  "64/ESCAR60": "VITORIA",
  "64/SMA02": "VITORIA",
  "64/ESPIU04": "VITORIA",
  "64/COBERT LITORAL SUL": "VITORIA",
  "64/ESCUP37": "VITORIA",
  "64/REGULADOR": "VITORIA",
  "65/570172 AGUIA BRANCA": "AGUIA BRANCA",
  "65/REGULADOR": "VITORIA",
  "65/561184  MILLS": "VITORIA",
  "67/INST. GPON GIGAMAIS": "VITORIA",
  "67/FERRAMENTAL GIGAMAIS": "VITORIA",
  "61/SEGREGADO VILA VELHA": "VILA VELHA",
  "46/TI ESPIRITO SANTO": "VITORIA",

  // Rio de Janeiro
  "46/TI": "RIO DE JANEIRO",
  "46/TI SP": "SAO PAULO",
  "46/TI BELO HORIZONTE": "BELO HORIZONTE",
  "46/TI LIGGA PR": "CURITIBA",
  "52/MINAS GERAIS": "BELO HORIZONTE",
  "52/RIO DE JANEIRO": "RIO DE JANEIRO",
  "52/PARANÁ": "CURITIBA",
  "52/PARANA": "CURITIBA",
  "2/02/SEGREGADO SP": "SAO PAULO",
  "2/02/SEGREGADO RJ": "RIO DE JANEIRO",
  "2/02/SEGREGADO LAGOS": "LAGOS",
  "2/02/SEGREGADO NITERÓI": "NITEROI",
  "999/999": "INVENTARIO",
  "- CAMPOS": "CAMPOS",
  "34/CLARO - CAMPOS": "CAMPOS",
  "- LAGOS GPON": "LAGOS",
  "34/CLARO - LAGOS GPON": "LAGOS",
  "TRABALHO RJO": "RIO DE JANEIRO",
  "41/SEG TRABALHO RJO": "RIO DE JANEIRO",
  "TRESRIOS-PARAIBA": "TRES RIOS",
  "47/MDU TRESRIOS-PARAIBA": "TRES RIOS",
  "ESTOQUE": "RIO DE JANEIRO",
  "47/MDU ESTOQUE": "RIO DE JANEIRO",
  "PROJETO F": "RIO DE JANEIRO",
  "47/MDU PROJETO F": "RIO DE JANEIRO",
  "60/OBRA DUTRA": "RIO DE JANEIRO",
  "60/OBRAS DE MANUTENÇÃO": "RIO DE JANEIRO",
  "60/REG. REDE EXTERNA": "RIO DE JANEIRO",
  "60/OBRA BTFAG": "RIO DE JANEIRO",
  "REG SSO": "RIO DE JANEIRO",
  "REG SSO RJ": "RIO DE JANEIRO",
  "SSO": "RIO DE JANEIRO",
};

/**
 * Extrai e padroniza o nome da cidade a partir do campo `grupo` do material.
 * O campo grupo tem formato: "CODIGO/NOME_PROJETO" ex: "21/FERRAM. CLARO IAT"
 * A função remove o prefixo (tudo até o primeiro espaço), normaliza e aplica aliases.
 * Se o resultado for genérico ou inválido, aplica fallback inteligente baseado no número do contrato.
 */
export function padronizarNomeCidade(grupoOriginal: string): string {
  if (!grupoOriginal) return '';

  // 1. Lookup pelo grupo completo normalizado (com o prefixo numérico, ex: "36/FTTC")
  const comPrefixo = grupoOriginal.trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\.\s+/g, '.');
  if (ALIAS_CIDADE[comPrefixo]) return ALIAS_CIDADE[comPrefixo];

  // 2. Extrair o nome após o primeiro espaço
  let nome = '';
  const idxEspaco = grupoOriginal.indexOf(' ');
  if (idxEspaco !== -1) {
    nome = grupoOriginal.substring(idxEspaco + 1).trim().toUpperCase();
  } else {
    // Se não tem espaço, remove o prefixo "XX/" se houver
    nome = grupoOriginal.replace(/^\d+\//, '').trim().toUpperCase();
  }
  nome = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\.\s+/g, '.');

  // 3. Lookup direto pelo nome parcial
  if (ALIAS_CIDADE[nome]) return ALIAS_CIDADE[nome];

  // 4. Lookup pelo nome sem o prefixo numérico (ex: "FERRAM.CLARO IAT")
  const semPrefixo = grupoOriginal.replace(/^\d+\//, '').trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
    .replace(/\.\s+/g, '.');
  if (ALIAS_CIDADE[semPrefixo]) return ALIAS_CIDADE[semPrefixo];

  // 5. Redirecionamentos para subgrupos interestaduais conhecidos
  if (nome.includes('SP') || nome.includes('SAO PAULO') || nome.includes('SÃO PAULO')) return 'SAO PAULO';
  if (nome === 'ESPIRITO SANTO' || nome === 'ES') return 'VITORIA';
  if (nome.includes('PR') || nome.includes('PARANA') || nome.includes('CURITIBA') || nome.includes('LIGGA')) return 'CURITIBA';
  if (nome.includes('BH') || nome.includes('BELO HORIZONTE') || nome.includes('MINAS') || nome.includes('MG')) return 'BELO HORIZONTE';

  // 6. Lista de palavras-chave inválidas/genéricas que não indicam uma cidade/região real
  const PALAVRAS_INVALIDAS = [
    'CORRETIVA', 'TRABALHO', 'SP', 'RJ', 'ES', 'PR', 'MG', 'SSO', 'FERRAMENTAS', 'FERRAMENTAL', 'FERRAMENTARIA',
    'FTTC', 'FTTH', 'CLEAN', 'UP', 'ADEQUACAO', 'ALIVIO', 'ESTOQUE', 'GPON', 'DUTRA', 'MANUTENCAO', 'PREVEN', 'PREVENTIVA',
    'BOBINAS', 'COMPRAS', 'COAXIAL', 'BUZIOS', 'LIGGA', 'CLARO', 'TIM', 'VIVO', 'GIGAMAIS', 'MILLS', 'SEGREGADO',
    'REGULADOR', 'GIGA', 'CPS', 'RJO', 'IAT', 'OBRA', 'OBRAS', 'NODE', 'FOTONICO', 'IMPLEMENTACAO', 'IMPLANTACAO',
    'MDU', 'HFC', 'TI', 'HUB', 'SULACAP', 'PIEDADE', 'GENERICO', 'SGI'
  ];

  const contemInvalida = PALAVRAS_INVALIDAS.some(p => nome.includes(p));

  // 7. Se o nome contiver palavras inválidas ou for genérico, aplicar fallback por contrato
  if (contemInvalida || nome.length <= 3) {
    const match = grupoOriginal.match(/^(\d+)\//);
    if (match) {
      const contrato = parseInt(match[1], 10);
      if ([71, 72].includes(contrato)) return 'CURITIBA';
      if ([1, 31, 36, 37, 38].includes(contrato)) return 'SAO PAULO';
      if ([58, 59].includes(contrato)) return 'BELO HORIZONTE';
      if ([61, 62, 64, 65, 67].includes(contrato)) return 'VITORIA';
      if ([21, 23, 24, 34, 40, 41, 42, 43, 45, 47, 48, 49, 52, 60].includes(contrato)) {
        if (contrato === 52) {
          if (grupoOriginal.includes('PARANÁ')) return 'CURITIBA';
          if (grupoOriginal.includes('MINAS')) return 'BELO HORIZONTE';
          if (grupoOriginal.includes('SÃO PAULO')) return 'SAO PAULO';
          return 'RIO DE JANEIRO';
        }
        return 'RIO DE JANEIRO';
      }
    }
  }

  return nome;
}

export function filtrarMateriais(
  materiais: Material[],
  filtro: FiltroState | string,
  contagens: ContagensMap = {},
  apenasDivergentes = false
): Material[] {
  let resultado = [...materiais];

  if (apenasDivergentes) {
    resultado = resultado.filter((m) => {
      const temContagem = m.id in contagens;
      if (!temContagem) return false;
      return contagens[m.id].novaQtd !== m.saldoAtual;
    });
  }

  if (typeof filtro === 'string') {
    if (!filtro || filtro.trim() === '') return resultado;
    const termoUpper = filtro.trim().toUpperCase();
    return resultado.filter((m) => {
      const descricao = (m.descricao || '').toUpperCase();
      const origem = (m.origem || '').toUpperCase();
      const unidade = (m.unidade || '').toUpperCase();
      return descricao.includes(termoUpper) || origem.includes(termoUpper) || unidade.includes(termoUpper);
    });
  }

  if (filtro && typeof filtro === 'object') {
    const { termo, tipo } = filtro;

    if (termo && termo.trim() !== '') {
      const termoUpper = termo.trim().toUpperCase();
      resultado = resultado.filter((m) => {
        const descricao = (m.descricao || '').toUpperCase();
        const origem = (m.origem || '').toUpperCase();
        const uni = (m.unidade || '').toUpperCase();
        return descricao.includes(termoUpper) || origem.includes(termoUpper) || uni.includes(termoUpper);
      });
    }

    if (tipo && tipo !== 'todos') {
      resultado = resultado.filter((m) => (m.descricao || '') === tipo);
    }

    if (filtro.grupo && filtro.grupo !== 'todas') {
      const targetCity = filtro.grupo;
      resultado = resultado.filter((m) => padronizarNomeCidade(m.grupo || '') === targetCity);
    }
  }

  return resultado;
}

export function ordenarPor(
  materiais: Material[],
  coluna: keyof Material,
  direcao: 'asc' | 'desc' = 'asc'
): Material[] {
  if (!materiais.length) return [];
  const mult = direcao === 'desc' ? -1 : 1;

  return [...materiais].sort((a, b) => {
    const va = a[coluna];
    const vb = b[coluna];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'number' && typeof vb === 'number') return mult * (va - vb);
    const sa = String(va).toUpperCase();
    const sb = String(vb).toUpperCase();
    if (sa < sb) return mult * -1;
    if (sa > sb) return mult * 1;
    return 0;
  });
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: unknown[]) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  } as T;
}
