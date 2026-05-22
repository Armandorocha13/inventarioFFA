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
      <div className="landing-content">
        <div className="landing-logo-wrap">
          <Image src="/logo.png" alt="FFA Logo" width={72} height={72} className="landing-logo" />
        </div>
        <h1 className="landing-title">FFA INFRAESTRUTURA</h1>
        <p className="landing-subtitle">Selecione o perfil de acesso</p>

        <div className="landing-selectors" style={{ gap: '1rem', marginTop: '1rem', width: '100%' }}>
          <button
            className="btn-primary-nav"
            style={{ padding: '1.2rem', fontSize: '1rem', background: 'var(--success)' }}
            onClick={() => onSelecionarPerfil('contagem')}
          >
            <i className="fas fa-clipboard-list" style={{ marginRight: '8px' }}></i> Acessar Painel de Contagem
          </button>

          {!showPassword ? (
            <button
              className="btn-outline-nav"
              style={{ padding: '1.2rem', fontSize: '1rem' }}
              onClick={() => setShowPassword(true)}
            >
              <i className="fas fa-chart-line" style={{ marginRight: '8px' }}></i> Acessar Painel de Monitoramento
            </button>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%', background: 'var(--glass-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.8rem', textAlign: 'left' }}>Senha de Administrador</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Digite a senha"
                  value={senha}
                  onChange={(e) => { setSenha(e.target.value); setErro(false); }}
                  autoFocus
                />
                {erro && <span style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'left', marginTop: '0.2rem' }}>Senha incorreta!</span>}
              </div>
              <button type="submit" className="btn-primary-nav" style={{ padding: '0.8rem' }}>Entrar</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
