export function Badge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
}) {
  const cls = tone === 'default' ? 'badge' : `badge badge-${tone}`;
  return <span className={cls}>{children}</span>;
}
