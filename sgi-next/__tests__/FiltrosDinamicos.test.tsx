import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppScreen from '@/components/AppScreen';

// Mock sub-components so we test AppScreen filter logic in isolation
vi.mock('@/components/TabContagem', () => ({
  default: ({ materiaisVisiveis }: any) => (
    <div data-testid="tab-contagem">
      Contagem ({materiaisVisiveis?.length || 0} itens)
    </div>
  )
}));

vi.mock('@/components/TabMonitoramento', () => ({
  default: ({ materiais }: any) => (
    <div data-testid="tab-monitoramento">
      Monitoramento ({materiais?.length || 0} itens)
    </div>
  )
}));

const mockAlmoxarifados = [
  { codigo: 'RJ|111', label: 'Niterói - CONTRATO: 111', cidade: 'RIO DE JANEIRO', contrato: 111 },
  { codigo: 'RJ|222', label: 'Campos - CONTRATO: 222', cidade: 'RIO DE JANEIRO', contrato: 222 },
  { codigo: 'ES|333', label: 'Vitória - CONTRATO: 333', cidade: 'ESPIRITO SANTO', contrato: 333 },
  { codigo: 'SP|444', label: 'Santos - CONTRATO: 444', cidade: 'SÃO PAULO', contrato: 444 },
];

const mockTodos = {
  RJ: [
    { codigo: 'RJ|111', label: 'Niterói - CONTRATO: 111', cidade: 'RIO DE JANEIRO', contrato: 111 },
    { codigo: 'RJ|222', label: 'Campos - CONTRATO: 222', cidade: 'RIO DE JANEIRO', contrato: 222 },
  ],
  ES: [
    { codigo: 'ES|333', label: 'Vitória - CONTRATO: 333', cidade: 'ESPIRITO SANTO', contrato: 333 },
  ],
  SP: [
    { codigo: 'SP|444', label: 'Santos - CONTRATO: 444', cidade: 'SÃO PAULO', contrato: 444 },
  ],
};

const mockMateriais = [
  { id: 1, origem: 'RIO DE JANEIRO', codmat: '100', descricao: 'Cabo', unidade: 'M', saldoAtual: 100, precoUnitario: 5, classeABC: 'A' },
  { id: 2, origem: 'RIO DE JANEIRO', codmat: '200', descricao: 'Poste', unidade: 'UN', saldoAtual: 10, precoUnitario: 50, classeABC: 'B' },
  { id: 3, origem: 'ESPIRITO SANTO', codmat: '300', descricao: 'Cruzeta', unidade: 'UN', saldoAtual: 20, precoUnitario: 30, classeABC: 'A' },
  { id: 4, origem: 'SÃO PAULO', codmat: '400', descricao: 'Isolador', unidade: 'UN', saldoAtual: 50, precoUnitario: 15, classeABC: 'C' },
];

const mockInventario = {
  state: {
    abaAtiva: 'monitoramento',
    materiais: mockMateriais,
    materiaisVisiveis: mockMateriais,
    contagens: {},
    colunaOrdenacao: null,
    direcaoOrdenacao: 'asc',
    filtros: { termo: '', tipo: 'todos' },
    carregando: false,
  },
  setAba: vi.fn(),
  carregarMateriais: vi.fn().mockResolvedValue(mockMateriais),
  registrarContagem: vi.fn(),
  restaurarContagens: vi.fn(),
  setFiltroTermo: vi.fn(),
  setFiltroTipo: vi.fn(),
  ordenarColuna: vi.fn(),
  resetar: vi.fn(),
  gravarContagens: vi.fn(),
};

describe('Filtros Dinâmicos na AppScreen', () => {
  it('deve renderizar os seletores de Estado, Projeto e Classificação', () => {
    const { container } = render(
      <AppScreen
        uf="todos"
        almoxarifados={mockAlmoxarifados}
        todos={mockTodos}
        inventario={mockInventario as any}
        perfil="monitoramento"
        onVoltarLanding={vi.fn()}
        toast={vi.fn()}
      />
    );

    expect(container.querySelector('#selectEstado')).toBeInTheDocument();
    expect(container.querySelector('#selectProjeto')).toBeInTheDocument();
    expect(container.querySelector('#selectClasse')).toBeInTheDocument();
  });

  it('deve filtrar os Projetos dinamicamente ao selecionar o Estado', async () => {
    const { container } = render(
      <AppScreen
        uf="todos"
        almoxarifados={mockAlmoxarifados}
        todos={mockTodos}
        inventario={mockInventario as any}
        perfil="monitoramento"
        onVoltarLanding={vi.fn()}
        toast={vi.fn()}
      />
    );

    const selectEstado = container.querySelector('#selectEstado') as HTMLSelectElement;
    const selectProjeto = container.querySelector('#selectProjeto') as HTMLSelectElement;

    // Inicialmente, todos os projetos devem estar listados
    expect(screen.getByText(/Niterói - CONTRATO: 111/i)).toBeInTheDocument();
    expect(screen.getByText(/Vitória - CONTRATO: 333/i)).toBeInTheDocument();

    // Selecionar Espírito Santo (ES)
    fireEvent.change(selectEstado, { target: { value: 'ES' } });

    // Agora, apenas os projetos do Espírito Santo devem aparecer
    expect(screen.queryByText(/Niterói - CONTRATO: 111/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Vitória - CONTRATO: 333/i)).toBeInTheDocument();
  });

  it('deve filtrar os materiais exibidos com base nos filtros selecionados', async () => {
    const { container } = render(
      <AppScreen
        uf="todos"
        almoxarifados={mockAlmoxarifados}
        todos={mockTodos}
        inventario={mockInventario as any}
        perfil="monitoramento"
        onVoltarLanding={vi.fn()}
        toast={vi.fn()}
      />
    );

    const selectEstado = container.querySelector('#selectEstado') as HTMLSelectElement;
    const selectClasse = container.querySelector('#selectClasse') as HTMLSelectElement;

    // Filtra por Estado SP
    fireEvent.change(selectEstado, { target: { value: 'SP' } });
    
    // Filtra por Classe C
    fireEvent.change(selectClasse, { target: { value: 'C' } });

    // A lista final deve refletir apenas materiais de São Paulo (origem Santos) e Classe C
    // Como a filtragem ocorre em tempo de render, o TabMonitoramento correspondente deve mostrar (1 itens)
    await waitFor(() => {
      expect(screen.getByText(/Monitoramento \(1 itens\)/i)).toBeInTheDocument();
    });
  });
});
