import React, { useState } from 'react';
import Image from 'next/image';

interface LoginScreenProps {
  onSelecionarPerfil: (perfil: 'contagem' | 'monitoramento') => void;
}

export default function LoginScreen({ onSelecionarPerfil }: LoginScreenProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (senha === 'admin') {
      onSelecionarPerfil('monitoramento');
    } else {
      setErro(true);
    }
  };

  return (
    <div className="landing-screen" style={{ opacity: 1, pointerEvents: 'all', transform: 'scale(1)' }}>
      <div className="landing-content" style={{ maxWidth: '440px' }}>
        {/* Marca unificada da FFA e do projeto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem', justifyContent: 'center' }}>
          <Image src="/logo.png" alt="FFA Logo" width={64} height={32} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', textAlign: 'left' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: '1.1' }}>FFA INFRAESTRUTURA</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '1.1' }}>Sistema de Inventário</span>
          </div>
        </div>

        {/* Card de Acesso */}
        <div className="card" style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--glass-bg-strong)', textAlign: 'left' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>Painel de Login</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Selecione o seu perfil para prosseguir</p>
          </div>

          <div className="landing-selectors" style={{ gap: '1rem', width: '100%' }}>
            <button
              className="btn-primary-nav"
              style={{ 
                padding: '1.1rem', 
                fontSize: '0.95rem', 
                background: 'var(--success)', 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '8px'
              }}
              onClick={() => onSelecionarPerfil('contagem')}
            >
              <i className="fas fa-clipboard-list"></i> Acessar Painel de Contagem
            </button>

            {!showPassword ? (
              <button
                className="btn-outline-nav"
                style={{ 
                  padding: '1.1rem', 
                  fontSize: '0.95rem', 
                  width: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  marginTop: '0.5rem'
                }}
                onClick={() => setShowPassword(true)}
              >
                <i className="fas fa-chart-line"></i> Acessar Painel de Monitoramento
              </button>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', background: 'rgba(var(--primary-rgb), 0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--glass-border)', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Senha Administrativa
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Digite a senha..."
                    value={senha}
                    onChange={(e) => { setSenha(e.target.value); setErro(false); }}
                    autoFocus
                    style={{ width: '100%', marginTop: '0.35rem' }}
                  />
                  {erro && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', display: 'block', marginTop: '0.35rem' }}><i className="fas fa-exclamation-circle"></i> Senha incorreta!</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn-outline-nav" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }} onClick={() => setShowPassword(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary-nav" style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}>Entrar</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
