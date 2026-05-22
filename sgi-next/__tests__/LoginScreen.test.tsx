import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LoginScreen from '@/components/LoginScreen'

describe('LoginScreen Component', () => {
  it('renderiza os botoes de perfil corretamente', () => {
    render(<LoginScreen onSelecionarPerfil={vi.fn()} />)
    
    expect(screen.getByText(/Acessar Painel de Contagem/i)).toBeInTheDocument()
    expect(screen.getByText(/Acessar Painel de Monitoramento/i)).toBeInTheDocument()
    
    // O campo de senha nao deve estar visivel no inicio
    expect(screen.queryByPlaceholderText(/Digite a senha/i)).not.toBeInTheDocument()
  })

  it('aciona onSelecionarPerfil diretamente ao escolher Contagem', () => {
    const handlePerfil = vi.fn()
    render(<LoginScreen onSelecionarPerfil={handlePerfil} />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Contagem/i))
    expect(handlePerfil).toHaveBeenCalledWith('contagem')
  })

  it('exibe o campo de senha ao clicar em Monitoramento', () => {
    render(<LoginScreen onSelecionarPerfil={vi.fn()} />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Monitoramento/i))
    expect(screen.getByPlaceholderText(/Digite a senha/i)).toBeInTheDocument()
  })

  it('exibe erro com senha incorreta para Monitoramento', () => {
    render(<LoginScreen onSelecionarPerfil={vi.fn()} />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Monitoramento/i))
    const input = screen.getByPlaceholderText(/Digite a senha/i)
    
    fireEvent.change(input, { target: { value: 'senhaerrada' } })
    fireEvent.click(screen.getByText(/Entrar/i))
    
    expect(screen.getByText(/Senha incorreta/i)).toBeInTheDocument()
  })

  it('aciona onSelecionarPerfil ao fornecer a senha correta (admin)', () => {
    const handlePerfil = vi.fn()
    render(<LoginScreen onSelecionarPerfil={handlePerfil} />)
    
    fireEvent.click(screen.getByText(/Acessar Painel de Monitoramento/i))
    const input = screen.getByPlaceholderText(/Digite a senha/i)
    
    fireEvent.change(input, { target: { value: 'admin' } })
    fireEvent.click(screen.getByText(/Entrar/i))
    
    expect(handlePerfil).toHaveBeenCalledWith('monitoramento')
  })
})
