export function EmptyState({
  title,
  description,
  action,
  icon = '📭',
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="empty card">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Загрузка...' }: { label?: string }) {
  return (
    <div className="state-box" role="status">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message = 'Не удалось загрузить данные. Попробуйте ещё раз.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-box card" role="alert">
      <p className="error-text">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary btn-md" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Alert({
  tone = 'info',
  children,
  onClose,
}: {
  tone?: 'success' | 'error' | 'info' | 'warning';
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert-close" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
      )}
    </div>
  );
}
