import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  inicializarFiltros,
  getEstados,
  getTodasUFs,
  getAlmoxarifados,
  buscarMateriais,
  buscarHistoricoBanco,
  gravarContagensBanco,
} from '../js/dadosFonte.js';

describe('dadosFonte (Assíncrono via API Neon)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('inicializarFiltros', () => {
    it('deve buscar e carregar os filtros da API com sucesso', async () => {
      const mockFiltros = {
        estados: [
          { sigla: 'RJ', nome: 'Rio de Janeiro' },
          { sigla: 'ES', nome: 'Espírito Santo' },
        ],
        almoxarifados: {
          RJ: [{ codigo: 'RJO|101', label: 'RJO - Rio de Janeiro' }],
          ES: [{ codigo: 'VVA|102', label: 'VVA - Vila Velha' }],
        },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFiltros,
      });

      const resultado = await inicializarFiltros();
      expect(resultado).toBe(true);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/filtros');

      // Testa os métodos síncronos após inicializar
      expect(getEstados()).toEqual(mockFiltros.estados);
      expect(getTodasUFs()).toEqual(['RJ', 'ES']);
      expect(getAlmoxarifados('RJ')).toEqual(mockFiltros.almoxarifados.RJ);
      expect(getAlmoxarifados('ES')).toEqual(mockFiltros.almoxarifados.ES);
      expect(getAlmoxarifados('SP')).toEqual([]);
    });

    it('deve lidar com falha na requisição da API e propagar o erro', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(inicializarFiltros()).rejects.toThrow('Erro na requisição dos filtros: status 500');
    });
  });

  describe('buscarMateriais', () => {
    it('deve retornar array vazio se não passar codigoAlmox', async () => {
      const materiais = await buscarMateriais(null);
      expect(materiais).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('deve buscar todos os materiais se codigoAlmox for todos', async () => {
      const mockMateriais = [
        { id: '1', descricao: 'MAT 1', saldoAtual: 10, precoUnitario: 5 },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMateriais,
      });

      const materiais = await buscarMateriais('todos');
      expect(materiais).toEqual(mockMateriais);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/materiais?cidade=todos&contrato=todos');
    });

    it('deve dividir a string do almoxarifado em cidade e contrato e fazer fetch correto', async () => {
      const mockMateriais = [
        { id: '2', descricao: 'MAT 2', saldoAtual: 20, precoUnitario: 15 },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockMateriais,
      });

      const materiais = await buscarMateriais('RIO DE JANEIRO|1025');
      expect(materiais).toEqual(mockMateriais);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/materiais?cidade=RIO%20DE%20JANEIRO&contrato=1025');
    });

    it('deve propagar erro se a chamada falhar', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(buscarMateriais('todos')).rejects.toThrow('Erro ao buscar materiais: status 400');
    });
  });

  describe('buscarHistoricoBanco', () => {
    it('deve retornar o historico retornado pelo backend com sucesso', async () => {
      const mockHistorico = [
        { id: 1, codmat: '1001', valorNovo: 50, valorAnterior: 10, auditor: 'SGI local' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHistorico,
      });

      const historico = await buscarHistoricoBanco();
      expect(historico).toEqual(mockHistorico);
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/historico');
    });

    it('deve propagar erro em caso de falha da API', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(buscarHistoricoBanco()).rejects.toThrow('Erro ao buscar histórico: status 500');
    });
  });

  describe('gravarContagensBanco', () => {
    it('deve retornar erro estruturado se lista de contagens for vazia', async () => {
      const resultado = await gravarContagensBanco([]);
      expect(resultado).toEqual({ success: false, error: 'Lista de contagens está vazia.' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('deve enviar POST com contagens formatadas e retornar sucesso', async () => {
      const mockContagens = [
        { id: '123', codmat: '1001', descricao: 'MAT 1', valorAnterior: 10, valorNovo: 15, observacao: 'Tudo OK' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, count: 1 }),
      });

      const resultado = await gravarContagensBanco(mockContagens);
      expect(resultado).toEqual({ success: true, count: 1 });
      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/contagem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockContagens),
      });
    });

    it('deve propagar erro se post falhar', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(gravarContagensBanco([{ id: '123' }])).rejects.toThrow('Erro ao gravar contagens: status 500');
    });
  });
});
