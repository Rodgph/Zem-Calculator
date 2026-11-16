import { useState } from 'react';
import Modal from './Modal.jsx';

export default function ImportDialog({ file, busy, error, status, onCancel, onImport }) {
  const [name, setName] = useState('');

  function submit(event) {
    event.preventDefault();
    onImport(name.trim());
  }

  return (
    <Modal title="Novo contêiner" onClose={busy ? () => {} : onCancel}>
      <form onSubmit={submit}>
        <p className="file-name">{file.name}</p>
        {busy && status && <p className="import-progress" role="status">{status}</p>}
        <label className="field">
          Nome ou número do contêiner
          <input
            autoFocus
            autoComplete="off"
            placeholder="Ex.: 1, 2 ou novembro"
            value={name}
            onChange={event => setName(event.target.value)}
            required
            disabled={busy}
          />
        </label>
        {error && <p className="error-message" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Importando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
