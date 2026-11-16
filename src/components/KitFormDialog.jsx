import { useState } from 'react';
import Modal from './Modal.jsx';
import { formatCurrency } from '../lib/pricing.js';

export default function KitFormDialog({ product, existingSkus, busy, onClose, onSave }) {
  const [name, setName] = useState(`${product.nome || product.sku} - Kit`);
  const [sku, setSku] = useState(() => {
    const baseSku = `${product.sku}-KIT`.toLocaleUpperCase('pt-BR');
    const usedSkus = new Set(existingSkus.map(value => String(value).trim().toLocaleUpperCase('pt-BR')));
    let candidate = baseSku;
    let suffix = 2;
    while (usedSkus.has(candidate)) {
      candidate = `${baseSku}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  });
  const [quantity, setQuantity] = useState('2');
  const [error, setError] = useState('');
  const quantityValue = Number(quantity);
  const validQuantity = Number.isSafeInteger(quantityValue) && quantityValue >= 2;
  const cost = validQuantity ? Number(product.custo) * quantityValue : Number.NaN;

  async function submit(event) {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    if (!name.trim() || !sku.trim()) {
      setError('Informe o nome e o SKU do kit.');
      return;
    }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 2) {
      setError('A quantidade do kit deve ser um número inteiro igual ou maior que 2.');
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setError('O custo calculado para o kit deve ser maior que zero.');
      return;
    }

    setError('');
    const saved = await onSave({
      nome: name.trim(),
      sku: sku.trim().toUpperCase(),
      kitQuantity: parsedQuantity,
      custo: cost,
    });
    if (saved) onClose();
  }

  return (
    <Modal title={`Criar kit de ${product.nome || product.sku}`} onClose={busy ? () => {} : onClose}>
      <form onSubmit={submit}>
        <label className="field">
          Nome do kit
          <input value={name} onChange={event => setName(event.target.value)} disabled={busy} autoFocus />
        </label>
        <label className="field">
          SKU
          <input value={sku} onChange={event => setSku(event.target.value.toUpperCase())} disabled={busy} />
        </label>
        <label className="field">
          Unidades do produto no kit
          <input
            type="number"
            min="2"
            step="1"
            value={quantity}
            onChange={event => setQuantity(event.target.value)}
            disabled={busy}
          />
        </label>
        <p className="kit-cost-preview">
          Custo: {formatCurrency(product.custo)} × {validQuantity ? quantityValue : '—'} = <strong>{formatCurrency(cost)}</strong>
        </p>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Criando…' : 'Criar kit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
