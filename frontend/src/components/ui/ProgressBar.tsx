export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="progress" title={`${v}%`}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}
