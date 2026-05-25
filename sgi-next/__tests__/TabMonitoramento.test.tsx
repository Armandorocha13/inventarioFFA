import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TabMonitoramento from '@/components/TabMonitoramento';

const mockMateriais = [
  { id: 1, origem: 'RIO DE JANEIRO', codmat: '100', descricao: 'Cabo', unidade: 'M', saldoAtual: 100, precoUnitario: 5, classeABC: 'A', ultimaAtualizacao: '2026-05-25' },
  { id: 2, origem: 'RIO DE JANEIRO', codmat: '200', descricao: 'Poste', unidade: 'UN', saldoAtual: 10, precoUnitario: 50, classeABC: 'B', ultimaAtualizacao: '2026-05-25' },
];

const mockContagens = {
  1: { novaQtd: 100, observacao: '' },
};

describe('TabMonitoramento Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve renderizar o botão de exportar analítico no cabeçalho da tabela', () => {
    render(<TabMonitoramento materiais={mockMateriais} contagens={mockContagens} />);

    // Deve encontrar o botão com texto "Exportar Analítico"
    const exportBtn = screen.getByRole('button', { name: /Exportar Analítico/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('deve chamar XLSX para salvar o arquivo ao clicar em exportar', () => {
    // Mock global window.XLSX e window.alert
    const mockWriteFile = vi.fn();
    const mockJsonToSheet = vi.fn().mockReturnValue({});
    const mockBookNew = vi.fn().mockReturnValue({});
    const mockBookAppendSheet = vi.fn();

    (window as any).XLSX = {
      utils: {
        json_to_sheet: mockJsonToSheet,
        book_new: mockBookNew,
        book_append_sheet: mockBookAppendSheet,
      },
      writeFile: mockWriteFile,
    };

    render(<TabMonitoramento materiais={mockMateriais} contagens={mockContagens} />);

    const exportBtn = screen.getByRole('button', { name: /Exportar Analítico/i });
    fireEvent.click(exportBtn);

    expect(mockBookNew).toHaveBeenCalled();
    expect(mockJsonToSheet).toHaveBeenCalled();
    expect(mockBookAppendSheet).toHaveBeenCalled();
    expect(mockWriteFile).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining('SGI_Tabela_Analitica_'));

    delete (window as any).XLSX;
  });
});
