import Modal from './Modal.jsx';

export default function ConfirmDialog({ title, message, busy, onCancel, onConfirm, confirmLabel = 'Apagar contêiner' }) {
  return (
    <Modal title={title} onClose={busy ? () => {} : onCancel}>
      <p>{message}</p>
      <p className="warning-note">
        Esta ação é permanente e não pode ser desfeita.
      </p>
      <div className="modal-actions">
        <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button className="btn danger" type="button" onClick={onConfirm} disabled={busy}>
          {busy ? 'Apagando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
