import { useState } from 'react';
import Modal from './Modal.jsx';
import { MARKETS, parseAmount } from '../lib/pricing.js';

function getFeeInputValue(fee, field) {
  return fee?.[field] == null ? '' : String(fee[field]).replace('.', ',');
}

export default function MarketplaceFeesDialog({ fees, busy, onClose, onSave }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(
    MARKETS.map(market => [
      market.key,
      {
        com: getFeeInputValue(fees[market.key], 'com'),
        fix: getFeeInputValue(fees[market.key], 'fix'),
        imp: getFeeInputValue(fees[market.key], 'imp'),
      },
    ]),
  ));
  const [error, setError] = useState('');

  function updateFee(market, field, value) {
    setDrafts(current => ({
      ...current,
      [market]: { ...current[market], [field]: value },
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const records = [];
    for (const market of MARKETS) {
      const draft = drafts[market.key];
      const values = ['com', 'fix', 'imp'].map(field => parseAmount(draft[field]));
      if (values.every(value => value == null)) continue;
      if (values.some(value => value == null || value < 0)) {
        setError(`Preencha comissão, taxa fixa e imposto de ${market.name} com valores válidos.`);
        return;
      }
      if (values[0] + values[2] >= 100) {
        setError(`A comissão e o imposto de ${market.name} juntos precisam ser menores que 100%.`);
        return;
      }
      records.push({
        marketplace: market.key,
        com: values[0],
        fix: values[1],
        imp: values[2],
      });
    }

    if (!records.some(record => record.marketplace !== 'shopee')) {
      setError('Configure as taxas de pelo menos um marketplace além da Shopee.');
      return;
    }

    setError('');
    if (await onSave(records)) onClose();
  }

  return (
    <Modal title="Taxas dos marketplaces" onClose={busy ? () => {} : onClose} wide>
      <form onSubmit={submit}>
        <p className="muted marketplace-fees-intro">
          Informe as taxas da sua conta conforme o painel de cada marketplace. Os valores ficam salvos no Supabase.
        </p>
        <div className="marketplace-fees-list">
          {MARKETS.map(market => (
            <fieldset className="marketplace-fee-row" key={market.key}>
              <legend>{market.name}</legend>
              <label className="field">
                Comissão (%)
                <input
                  inputMode="decimal"
                  value={drafts[market.key].com}
                  onChange={event => updateFee(market.key, 'com', event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="field">
                Taxa fixa (R$)
                <input
                  inputMode="decimal"
                  value={drafts[market.key].fix}
                  onChange={event => updateFee(market.key, 'fix', event.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="field">
                Impostos (%)
                <input
                  inputMode="decimal"
                  value={drafts[market.key].imp}
                  onChange={event => updateFee(market.key, 'imp', event.target.value)}
                  disabled={busy}
                />
              </label>
            </fieldset>
          ))}
        </div>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar taxas'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
