export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty card">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Загрузка...' }: { label?: string }) {
  return <div className="state-box">{label}</div>;
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-box card">
      <p className="error-text">{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}
