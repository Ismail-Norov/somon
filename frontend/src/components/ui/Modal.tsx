'use client';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row space-between" style={{ marginBottom: '1rem' }}>
          <h3>{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
