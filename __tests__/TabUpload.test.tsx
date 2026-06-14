import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TabUpload from '@/components/TabUpload';

describe('TabUpload Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve renderizar a tela de upload e responder ao clique em Voltar', () => {
    const handleVoltar = vi.fn();
    render(<TabUpload onVoltar={handleVoltar} />);

    expect(screen.getByText(/Atualização de Saldo de Estoque \(ERP\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Arraste e solte a planilha de saldo estoque aqui/i)).toBeInTheDocument();

    const voltarBtn = screen.getByRole('button', { name: /Voltar/i });
    fireEvent.click(voltarBtn);
    expect(handleVoltar).toHaveBeenCalled();
  });

  it('deve lidar com drag over e drag leave e alterar o estado visual', () => {
    render(<TabUpload onVoltar={vi.fn()} />);

    const dropzone = screen.getByText(/Arraste e solte a planilha de saldo estoque aqui/i).parentElement!;
    
    // Simula dragenter
    fireEvent.dragEnter(dropzone);
    expect(dropzone).toHaveStyle({ transform: 'scale(1.01)' });

    // Simula dragleave
    fireEvent.dragLeave(dropzone);
    expect(dropzone).toHaveStyle({ transform: 'scale(1)' });
  });

  it('deve aceitar arquivo excel arrastado e exibir botão de importação', () => {
    render(<TabUpload onVoltar={vi.fn()} />);

    const dropzone = screen.getByText(/Arraste e solte a planilha de saldo estoque aqui/i).parentElement!;
    
    const file = new File(['dummy content'], 'saldo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Simula drop
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file]
      }
    });

    // Deve mostrar as informações do arquivo e o botão de importação
    expect(screen.getByText(/saldo.xlsx/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Iniciar Importação/i })).toBeInTheDocument();
  });

  it('deve recusar arquivos que não sejam excel no drag and drop', () => {
    render(<TabUpload onVoltar={vi.fn()} />);

    const dropzone = screen.getByText(/Arraste e solte a planilha de saldo estoque aqui/i).parentElement!;
    
    const file = new File(['dummy content'], 'documento.pdf', { type: 'application/pdf' });
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file]
      }
    });

    expect(screen.getByText(/Por favor, arraste apenas arquivos Excel \(.xlsx ou .xls\)./i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar Importação/i })).not.toBeInTheDocument();
  });

  it('deve exibir overlay de processamento com a logo e barra de carregamento durante o upload', async () => {
    let resolveFetch: any;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = () => resolve({
        ok: true,
        json: async () => ({ success: true, insertedCount: 10, syncedCount: 5 })
      });
    });
    vi.spyOn(window, 'fetch').mockImplementation(() => fetchPromise as any);

    render(<TabUpload onVoltar={vi.fn()} onUploadSuccess={vi.fn()} />);

    const dropzone = screen.getByText(/Arraste e solte a planilha de saldo estoque aqui/i).parentElement!;
    const file = new File(['dummy content'], 'saldo.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file]
      }
    });

    const importBtn = screen.getByRole('button', { name: /Iniciar Importação/i });
    fireEvent.click(importBtn);

    expect(screen.getByText(/ATUALIZANDO SALDO ESTOQUE/i)).toBeInTheDocument();
    expect(screen.getByAltText(/FFA Logo/i)).toBeInTheDocument();
    expect(screen.getByText(/Processando dados da distribuidora e sincronizando contagens ativas.../i)).toBeInTheDocument();

    resolveFetch();

    await screen.findByText(/Sucesso! 10 registros importados. 5 contagens em progresso sincronizadas./i);
    expect(screen.queryByText(/ATUALIZANDO SALDO ESTOQUE/i)).not.toBeInTheDocument();
  });
});

