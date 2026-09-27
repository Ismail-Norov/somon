'use client';

export function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
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
