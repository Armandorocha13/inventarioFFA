'use client';

import { calcularProgresso } from '@/lib/auxiliaresUI';
import type { Material, ContagensMap } from '@/lib/auxiliaresUI';
import type { PerfilAcesso } from '@/app/page';

interface ModalConfirmacaoProps {
  materiais: Material[];
  contagens: ContagensMap;
  salvando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  perfil?: PerfilAcesso;
}

export default function ModalConfirmacao({
  materiais,
  contagens,
  salvando,
  onConfirmar,
  onCancelar,
  perfil,
}: ModalConfirmacaoProps) {
  const prog = calcularProgresso(materiais, contagens);
  const divergentes = Object.entries(contagens).filter(([id, c]) => {
    const m = materiais.find((mat) => mat.id === Number(id));
    return m && c.novaQtd !== m.saldoAtual;
  }).length;

  return (
    <div id="modalOverlay" className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal-content">
        <div className="modal-header">
          <i className="fas fa-check-circle modal-icon"></i>
          <h3>Finalizar Atualização</h3>
        </div>
        <div className="modal-body">
          <p>
            Você revisou todos os dados e está prestes a gravar a contagem física atual no sistema.
            Resumo da operação:
          </p>
          <div className="stats-grid">
            <div className="stat-box">
              <span id="modalResumoTotal">{prog.contados}</span>
              <small>Itens Auditados</small>
            </div>
            {perfil === 'contagem' ? (
              <div className="stat-box">
                <span>{prog.percentual}%</span>
                <small>Progresso Geral</small>
              </div>
            ) : (
              <div className="stat-box">
                <span id="modalResumoDivergencias">{divergentes}</span>
                <small>Divergências</small>
              </div>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <button
            id="btnCancelarSalvar"
            className="btn btn-secondary"
            onClick={onCancelar}
            disabled={salvando}
          >
            Voltar
          </button>
          <button
            id="btnConfirmarSalvar"
            className="btn btn-primary"
            onClick={onConfirmar}
            disabled={salvando}
          >
            {salvando ? (
              <><i className="fas fa-spinner fa-spin"></i> Gravando...</>
            ) : (
              <><i className="fas fa-save"></i> Confirmar e Gravar</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
