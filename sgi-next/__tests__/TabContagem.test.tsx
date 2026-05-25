import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabContagem from '@/components/TabContagem';

const mockMateriais = [
  { id: 1, origem: 'RIO DE JANEIRO', codmat: '100', descricao: 'Cabo', unidade: 'M', saldoAtual: 100, precoUnitario: 5, classeABC: 'A', ultimaAtualizacao: '2026-05-25' },
  { id: 2, origem: 'RIO DE JANEIRO', codmat: '200', descricao: 'Poste', unidade: 'UN', saldoAtual: 10, precoUnitario: 50, classeABC: 'B', ultimaAtualizacao: '2026-05-25' },
  { id: 3, origem: 'ESPIRITO SANTO', codmat: '300', descricao: 'Cruzeta', unidade: 'UN', saldoAtual: 20, precoUnitario: 30, classeABC: 'A', ultimaAtualizacao: '2026-05-25' },
  { id: 4, origem: 'SÃO PAULO', codmat: '400', descricao: 'Isolador', unidade: 'UN', saldoAtual: 50, precoUnitario: 15, classeABC: 'C', ultimaAtualizacao: '2026-05-25' },
];

const mockContagens = {
  1: { novaQtd: 100, observacao: '' },
};

describe('TabContagem Component', () => {
  it('deve exibir o contador de progresso dinâmico com base nos materiais visíveis (filtrados)', () => {
    // Apenas os materiais 1 e 2 são visíveis (filtro ativo no frontend)
    const materiaisVisiveis = [mockMateriais[0], mockMateriais[1]];

    render(
      <TabContagem
        materiais={mockMateriais}
        materiaisVisiveis={materiaisVisiveis}
        contagens={mockContagens}
        colunaOrdenacao={null}
        direcaoOrdenacao="asc"
        codigoAlmox="RJ|111"
        onRegistrarContagem={vi.fn()}
        onOrdenarColuna={vi.fn()}
        onAbrirModal={vi.fn()}
        setAba={vi.fn()}
      />
    );

    // Como o material 1 está contado (em mockContagens) e apenas 2 itens são visíveis,
    // o texto de progresso deve mostrar "1 de 2 itens contados", não "1 de 4"
    expect(screen.getByText(/1 de 2 itens contados/i)).toBeInTheDocument();
  });
});
