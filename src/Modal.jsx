export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">{children}</div>
    </div>
  );
}
