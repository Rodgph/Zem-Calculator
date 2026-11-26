import { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { compressImage, imageFromTransfer } from '../lib/images.js';
import { parseAmount } from '../lib/pricing.js';

export default function ProductFormDialog({ busy, onClose, onSave }) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [sku, setSku] = useState('');
  const [custo, setCusto] = useState('');
  const [imageBlob, setImageBlob] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    if (!imageBlob) {
      setPreview('');
      return undefined;
    }
    const url = URL.createObjectURL(imageBlob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageBlob]);

  async function setImage(file) {
    if (!file) return;
    setLoadingImage(true);
    setError('');
    try {
      setImageBlob(await compressImage(file));
    } catch (imageError) {
      setError(imageError.message || String(imageError));
    } finally {
      setLoadingImage(false);
    }
  }

  async function dropImage(event) {
    event.preventDefault();
    const file = event.dataTransfer.files[0] || await imageFromTransfer(event.dataTransfer);
    if (file) await setImage(file);
  }

  async function pasteImage(event) {
    const file = event.clipboardData.files[0];
    if (file) {
      event.preventDefault();
      await setImage(file);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const parsedCost = parseAmount(custo);
    if (!sku.trim() || parsedCost == null || parsedCost <= 0) {
      setError('Informe o SKU e um custo maior que zero.');
      return;
    }
    setError('');
    const saved = await onSave({
      nome: nome.trim(),
      descricao: descricao.trim(),
      sku: sku.trim().toUpperCase(),
      custo: parsedCost,
      imageBlob,
    });
    if (saved) onClose();
  }

  return (
    <Modal title="Novo produto" onClose={busy || loadingImage ? () => {} : onClose} wide>
      <form onSubmit={submit} onPaste={pasteImage}>
        <label
          className="image-drop"
          onDragOver={event => event.preventDefault()}
          onDrop={dropImage}
        >
          {preview ? (
            <img className="image-preview" src={preview} alt="Prévia do produto" />
          ) : (
            <span>{loadingImage ? 'Lendo imagem…' : 'Arraste uma imagem, cole com Ctrl+V ou escolha um arquivo'}</span>
          )}
          {preview && <span className="replace-preview">Trocar imagem</span>}
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={event => setImage(event.target.files[0])}
            disabled={busy || loadingImage}
          />
        </label>
        <label className="field">
          Nome do produto
          <input value={nome} onChange={event => setNome(event.target.value)} disabled={busy} />
        </label>
        <label className="field">
          Descrição
          <textarea value={descricao} onChange={event => setDescricao(event.target.value)} disabled={busy} rows={3} />
        </label>
        <label className="field">
          SKU
          <input value={sku} onChange={event => setSku(event.target.value.toUpperCase())} disabled={busy} />
        </label>
        <label className="field">
          Custo (R$)
          <input
            inputMode="decimal"
            value={custo}
            onChange={event => setCusto(event.target.value)}
            disabled={busy}
          />
        </label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy || loadingImage}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={busy || loadingImage}>
            {busy ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
