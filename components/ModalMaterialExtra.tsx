'use client';

import { useState } from 'react';

interface ModalMaterialExtraProps {
  onConfirmar: (dados: {
    codmat: string;
    descricao: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
    classeABC: string;
  }) => Promise<void>;
  onCancelar: () => void;
}

export default function ModalMaterialExtra({ onConfirmar, onCancelar }: ModalMaterialExtraProps) {
  const [codmat, setCodmat] = useState('');
  const [descricao, setDescricao] = useState('');
  const [unidade, setUnidade] = useState('PÇ');
  const [precoUnitario, setPrecoUnitario] = useState(0);
  const [quantidade, setQuantidade] = useState<number | ''>('');
  const [classeABC, setClasseABC] = useState('C');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codmat.trim() || !descricao.trim() || !unidade.trim() || quantidade === '') {
      setErro('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      await onConfirmar({
        codmat: codmat.trim(),
        descricao: descricao.trim(),
        unidade: unidade.trim().toUpperCase(),
        quantidade: Number(quantidade),
        precoUnitario: Number(precoUnitario),
        classeABC,
      });
    } catch (err: any) {
      setErro(err.message || 'Erro ao adicionar item.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content animate-scale-in" style={{ maxWidth: '480px', padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
            <i className="fas fa-plus"></i>
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Incluir Item Extra (Físico)</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Adiciona um item que não consta no sistema original</span>
          </div>
        </div>

        {erro && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.75rem', padding: '8px 12px', borderRadius: '8px', marginBottom: '1rem' }}>
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.88rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Código do Material *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: 1000032"
              value={codmat}
              onChange={(e) => setCodmat(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Descrição *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: ALICATE DE BICO 6"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.88rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Unidade *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ex: PÇ, M, LT"
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Preço Unitário (R$)</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={precoUnitario}
                onChange={(e) => setPrecoUnitario(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.88rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Qtd. Física *</label>
              <input
                type="number"
                className="form-control"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value === '' ? '' : Number(e.target.value))}
                required
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700 }}>Curva ABC</label>
              <select
                className="form-control"
                value={classeABC}
                onChange={(e) => setClasseABC(e.target.value)}
              >
                <option value="A">Classe A</option>
                <option value="B">Classe B</option>
                <option value="C">Classe C</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancelar} disabled={carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={carregando}>
              {carregando ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>} Incluir Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
