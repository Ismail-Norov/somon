import Link from 'next/link';

type Props = {
  icon: string;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
};

export function StatCard({ icon, label, value, hint, tone = 'brand', href }: Props) {
  const body = (
    <>
      <span className={`stat-icon stat-icon-${tone}`} aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </>
  );
  return href ? (
    <Link href={href} className="card stat-card stat-card-link">
      {body}
    </Link>
  ) : (
    <div className="card stat-card">{body}</div>
  );
}
