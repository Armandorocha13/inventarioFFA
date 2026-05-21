/**
 * dadosFonte.js — Fonte de dados externa do SGI
 * ─────────────────────────────────────────────────────────────────────────────
 * Este módulo não contém dados embutidos. Ele apenas expõe funções de leitura
 * a partir de uma fonte injetada (ex: window.SGI_DATA, API, SQLite).
 */

const FONTE_VAZIA = {
  estados: [],
  almoxarifados: {},
  materiais: {},
};

function normalizarFonte(fonte) {
  const estados = Array.isArray(fonte?.estados) ? fonte.estados : [];
  const almoxarifados =
    fonte?.almoxarifados && typeof fonte.almoxarifados === 'object'
      ? fonte.almoxarifados
      : {};
  const materiais =
    fonte?.materiais && typeof fonte.materiais === 'object' ? fonte.materiais : {};

  return { estados, almoxarifados, materiais };
}

let fonteAtual = normalizarFonte(globalThis.SGI_DATA || FONTE_VAZIA);

export function setFonteDados(novaFonte) {
  fonteAtual = normalizarFonte(novaFonte);
}

export function getEstados() {
  return [...fonteAtual.estados];
}

export function getTodasUFs() {
  return fonteAtual.estados.map(e => e.sigla);
}

export function getAlmoxarifados(uf) {
  if (!uf || !fonteAtual.almoxarifados[uf]) return [];
  return [...fonteAtual.almoxarifados[uf]];
}

export function getMateriais(codigoAlmox) {
  if (!codigoAlmox || !fonteAtual.materiais[codigoAlmox]) return [];
  return fonteAtual.materiais[codigoAlmox].map(m => ({ ...m }));
}
