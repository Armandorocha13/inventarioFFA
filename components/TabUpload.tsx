'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';

interface TabUploadProps {
  onVoltar: () => void;
  onUploadSuccess?: () => Promise<void>;
}

export default function TabUpload({ onVoltar, onUploadSuccess }: TabUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const fileExt = droppedFile.name.split('.').pop()?.toLowerCase();
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        setFile(droppedFile);
        setStatusMessage(null);
      } else {
        setStatusMessage({ text: 'Por favor, arraste apenas arquivos Excel (.xlsx ou .xls).', type: 'error' });
      }
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatusMessage(null);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setStatusMessage({ text: 'Processando arquivo e atualizando banco de dados...', type: 'info' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload-saldo', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar arquivo.');
      }

      setStatusMessage({ 
        text: `Sucesso! ${data.insertedCount} registros importados. ${data.syncedCount} contagens em progresso sincronizadas.`, 
        type: 'success' 
      });
      setFile(null);
      
      const fileInput = document.getElementById('fileUploadInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      if (onUploadSuccess) {
        await onUploadSuccess();
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Erro de conexão com o servidor.';
      setStatusMessage({ text: message, type: 'error' });
    } finally {
      setUploading(false);
    }
  }, [file, onUploadSuccess]);

  return (
    <div className="animate-fade-in" style={{ padding: '1rem 0' }}>
      {/* Header da Página de Upload */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={onVoltar} 
            disabled={uploading}
            style={{ margin: 0, padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <i className="fas fa-arrow-left"></i> Voltar
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Atualização de Saldo de Estoque (ERP)
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Importação automatizada de planilha de saldos brutos da distribuidora
            </p>
          </div>
        </div>
      </div>

      {/* Card Principal de Upload */}
      <div className="card" style={{ padding: '2.5rem', background: 'var(--glass-bg-strong)', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', position: 'relative', overflow: 'hidden' }}>
        {/* Style block for animations */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-slow {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0px rgba(59, 130, 246, 0)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.25)); }
          }
          @keyframes loading-bar {
            0% { left: -50%; }
            100% { left: 100%; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}} />

        {/* Loading Overlay */}
        {uploading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--glass-bg-strong)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            gap: '24px',
            animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <div style={{ position: 'relative', width: '120px', height: '60px', animation: 'pulse-slow 2s infinite ease-in-out', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Image src="/logo.png" alt="FFA Logo" width={120} height={60} style={{ objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '80%', maxWidth: '300px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.05em' }}>
                ATUALIZANDO SALDO ESTOQUE
              </span>
              <div style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '3px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: '50%',
                  background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                  borderRadius: '3px',
                  animation: 'loading-bar 1.5s infinite ease-in-out'
                }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Processando dados da distribuidora e sincronizando contagens ativas...
              </span>
            </div>
          </div>
        )}

        {/* Dropzone Area */}
        <div 
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            border: isDragActive ? '2px dashed var(--primary)' : '2px dashed var(--glass-border)',
            borderRadius: '12px',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: isDragActive ? 'rgba(59, 130, 246, 0.05)' : 'var(--glass-bg)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            transform: isDragActive ? 'scale(1.01)' : 'scale(1)',
            boxShadow: isDragActive ? '0 10px 25px -5px rgba(59, 130, 246, 0.08)' : 'none'
          }}
          onClick={() => {
            if (!uploading) {
              document.getElementById('fileUploadInput')?.click();
            }
          }}
        >
          <input 
            id="fileUploadInput"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: isDragActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)', 
            color: '#2563eb', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: '1.8rem',
            marginBottom: '0.5rem',
            transition: 'all 0.3s ease'
          }}>
            <i className="fas fa-cloud-upload-alt"></i>
          </div>
          <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Arraste e solte a planilha de saldo estoque aqui
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ou clique para selecionar o arquivo em seu computador
          </p>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--glass-bg-strong)', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--glass-border)' }}>
            Suporta formatos .xlsx e .xls
          </span>
        </div>

        {/* Selected File Details */}
        {file && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '1.25rem', 
            borderRadius: '10px', 
            background: 'var(--glass-bg)', 
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(22, 163, 74, 0.08)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                <i className="far fa-file-excel"></i>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{file.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Tamanho: {Math.round(file.size / 1024)} KB</span>
              </div>
            </div>
            <button 
              className="btn btn-primary" 
              onClick={handleUpload} 
              disabled={uploading}
              style={{ margin: 0, padding: '10px 20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {uploading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Processando...
                </>
              ) : (
                <>
                  <i className="fas fa-play"></i> Iniciar Importação
                </>
              )}
            </button>
          </div>
        )}

        {/* Status Message Display */}
        {statusMessage && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            fontSize: '0.8rem',
            background: statusMessage.type === 'success' ? 'rgba(22, 163, 74, 0.08)' : statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
            color: statusMessage.type === 'success' ? 'var(--success)' : statusMessage.type === 'error' ? 'var(--danger)' : 'var(--text-main)',
            border: `1px solid ${statusMessage.type === 'success' ? 'rgba(22, 163, 74, 0.15)' : statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <i className={statusMessage.type === 'success' ? "fas fa-check-circle" : statusMessage.type === 'error' ? "fas fa-exclamation-circle" : "fas fa-info-circle"} style={{ fontSize: '1rem' }}></i>
            <span style={{ fontWeight: 500 }}>{statusMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
