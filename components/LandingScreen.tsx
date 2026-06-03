'use client';

import Image from 'next/image';

interface Estado {
  sigla: string;
  nome: string;
}

interface LandingScreenProps {
  estados: Estado[];
  carregando: boolean;
  onSelecionarUF: (uf: string) => void;
}

export default function LandingScreen({ estados, carregando, onSelecionarUF }: LandingScreenProps) {
  return (
    <div id="landingScreen" className="landing-screen">
      <div className="landing-content" style={{ maxWidth: '440px' }}>
        {/* Marca unificada da FFA e do projeto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '2rem', justifyContent: 'center' }}>
          <Image src="/logo.png" alt="FFA Logo" width={64} height={32} style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', textAlign: 'left' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: '1.1' }}>FFA INFRAESTRUTURA</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '1.1' }}>Sistema de Inventário</span>
          </div>
        </div>

        {/* Card de Seleção */}
        <div className="card" style={{ width: '100%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--glass-bg-strong)', textAlign: 'left' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Quicksand, sans-serif' }}>Seleção de Base</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Selecione o estado para continuar</p>
          </div>

          <div className="landing-selectors" style={{ width: '100%' }}>
            <div className="landing-form-group">
              <label htmlFor="uf" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <i className="fas fa-map-marker-alt" style={{ marginRight: '4px' }}></i> Estado (UF)
              </label>
              <select
                id="uf"
                className="form-control landing-select"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem 1rem' }}
                disabled={carregando}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) onSelecionarUF(val);
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  {carregando ? 'Carregando estados...' : 'Selecione seu estado...'}
                </option>
                <option value="todos">Todas as bases (Geral)</option>
                {estados.map((e) => (
                  <option key={e.sigla} value={e.sigla}>
                    {e.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
