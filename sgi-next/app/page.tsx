'use client';

import { useState, useEffect, useCallback } from 'react';
import LandingScreen from '@/components/LandingScreen';
import AppScreen from '@/components/AppScreen';
import { useInventario } from '@/hooks/useInventario';

interface Estado {
  sigla: string;
  nome: string;
}

interface Almoxarifado {
  codigo: string;
  label: string;
  cidade: string;
  contrato: number;
}

interface FiltrosData {
  estados: Estado[];
  almoxarifados: Record<string, Almoxarifado[]>;
}

type Tela = 'landing' | 'app';

interface Toast {
  id: number;
  msg: string;
  tipo: 'sucesso' | 'erro' | 'info';
}

export default function HomePage() {
  const [tela, setTela] = useState<Tela>('landing');
  const [filtros, setFiltros] = useState<FiltrosData>({ estados: [], almoxarifados: {} });
  const [carregandoFiltros, setCarregandoFiltros] = useState(true);
  const [ufSelecionada, setUfSelecionada] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const inventario = useInventario();

  useEffect(() => {
    fetch('/api/filtros')
      .then((r) => r.json())
      .then((data: FiltrosData) => setFiltros(data))
      .catch(() => adicionarToast('Erro ao conectar ao banco de dados Neon.', 'erro'))
      .finally(() => setCarregandoFiltros(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adicionarToast = useCallback((msg: string, tipo: 'sucesso' | 'erro' | 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, tipo }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const handleSelecionarUF = useCallback((uf: string) => {
    setUfSelecionada(uf);
    inventario.resetar();
    setTela('app');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVoltarLanding = useCallback(() => {
    inventario.resetar();
    setUfSelecionada('');
    setTela('landing');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const almoxsParaUF = ufSelecionada === 'todos'
    ? Object.values(filtros.almoxarifados).flat()
    : filtros.almoxarifados[ufSelecionada] || [];

  return (
    <>
      {tela === 'landing' ? (
        <LandingScreen
          estados={filtros.estados}
          carregando={carregandoFiltros}
          onSelecionarUF={handleSelecionarUF}
        />
      ) : (
        <AppScreen
          uf={ufSelecionada}
          almoxarifados={almoxsParaUF}
          todos={filtros.almoxarifados}
          inventario={inventario}
          onVoltarLanding={handleVoltarLanding}
          toast={adicionarToast}
        />
      )}

      <div id="toastContainer">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <i className={`fas fa-${t.tipo === 'sucesso' ? 'check-circle' : t.tipo === 'erro' ? 'times-circle' : 'info-circle'}`}></i>
            {' '}{t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
