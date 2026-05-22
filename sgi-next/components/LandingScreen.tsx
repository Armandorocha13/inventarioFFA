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
      <div className="landing-content">
        <div className="landing-logo-wrap">
          <Image
            src="/logo.png"
            alt="FFA Infraestrutura"
            className="landing-logo"
            width={200}
            height={100}
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>

        <h1 className="landing-title">Plataforma de Inventário</h1>
        <p className="landing-subtitle">FFA Infraestrutura — Selecione seu estado para continuar</p>

        <div className="landing-selectors">
          <div className="landing-form-group">
            <label htmlFor="uf">
              <i className="fas fa-map-marker-alt"></i> Estado (UF)
            </label>
            <select
              id="uf"
              className="form-control landing-select"
              disabled={carregando}
              onChange={(e) => {
                const val = e.target.value;
                if (val) onSelecionarUF(val);
              }}
              defaultValue=""
            >
              <option value="" disabled>
                {carregando ? 'Carregando...' : 'Selecione seu estado...'}
              </option>
              <option value="todos">Todas as bases</option>
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
  );
}
