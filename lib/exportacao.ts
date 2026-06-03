/**
 * exportacao.ts — Módulo de Exportação do SGI
 */
import type { Material, ContagensMap } from './auxiliaresUI';

export interface LinhaExport {
  Origem: string;
  Descrição: string;
  Unidade: string;
  'Saldo Anterior': number;
  'Nova Contagem': number | null;
  Divergência: number | null;
  Observação: string;
  'Data Contagem': string;
}

export function prepararDadosExport(
  materiais: Material[],
  contagens: ContagensMap
): LinhaExport[] {
  if (!materiais || materiais.length === 0) return [];

  const agora = new Date().toLocaleString('pt-BR');

  return materiais.map((m) => {
    const contagem = contagens[m.id];
    const foiContado = contagem !== undefined;
    const novaQtd = foiContado ? contagem.novaQtd : null;
    const divergencia = foiContado ? contagem.novaQtd - m.saldoAtual : null;
    const observacao = foiContado ? contagem.observacao || '' : '';

    return {
      Origem: m.origem || '',
      Descrição: m.descricao || '',
      Unidade: m.unidade || '',
      'Saldo Anterior': m.saldoAtual,
      'Nova Contagem': novaQtd,
      Divergência: divergencia,
      Observação: observacao,
      'Data Contagem': foiContado ? agora : '',
    };
  });
}

export function gerarNomeArquivo(codigoAlmox: string): string {
  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  return `SGI_${codigoAlmox}_${hoje}.xlsx`;
}
