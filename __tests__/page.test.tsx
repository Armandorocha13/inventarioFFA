import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import HomePage from '@/app/page'

// Mocks dos sub-componentes para focar apenas no roteamento da page.tsx
vi.mock('@/components/LandingScreen', () => ({
  default: ({ onSelecionarUF }: any) => (
    <div data-testid="landing-screen">
      <button onClick={() => onSelecionarUF('SP')}>Selecionar SP</button>
    </div>
  )
}))

vi.mock('@/components/AppScreen', () => ({
  default: ({ perfil, uf }: any) => (
    <div data-testid="app-screen">
      App Screen (Perfil: {perfil}, UF: {uf})
    </div>
  )
}))

// Mock do hook useInventario
vi.mock('@/hooks/useInventario', () => ({
  useInventario: () => ({
    resetar: vi.fn(),
    setAba: vi.fn(),
  })
}))

describe('HomePage Roteamento (page.tsx)', () => {
  it('deve exibir a tela de login inicialmente', () => {
    render(<HomePage />)
    expect(screen.getByText(/Acessar Painel de Contagem/i)).toBeInTheDocument()
  })

  it('deve ir para a tela de landing se escolher Contagem', async () => {
    render(<HomePage />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Contagem/i))
    
    await waitFor(() => {
      expect(screen.getByTestId('landing-screen')).toBeInTheDocument()
    })
  })

  it('deve ir direto para o AppScreen se escolher Monitoramento com senha certa', async () => {
    render(<HomePage />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Monitoramento/i))
    
    const input = screen.getByPlaceholderText(/Digite a senha/i)
    fireEvent.change(input, { target: { value: 'admin' } })
    fireEvent.click(screen.getByText(/Entrar/i))
    
    await waitFor(() => {
      expect(screen.getByTestId('app-screen')).toBeInTheDocument()
      expect(screen.getByText(/Perfil: monitoramento/i)).toBeInTheDocument()
      expect(screen.getByText(/UF: todos/i)).toBeInTheDocument()
    })
  })
})
