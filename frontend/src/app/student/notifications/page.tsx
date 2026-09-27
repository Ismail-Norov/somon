'use client';

import { api } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';

type NotifPayload = {
  items: { id: string; title: string; body?: string; readAt?: string; createdAt: string; type: string }[];
  unreadCount: number;
};

export default function StudentNotificationsPage() {
  const { data, loading, error, reload } = useApiData<NotifPayload>('/api/notifications');

  async function markRead(id: string) {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
    reload();
  }

  async function markAll() {
    await api('/api/notifications/read-all', { method: 'POST' });
    reload();
  }

  const typeIcons: Record<string, string> = {
    ASSIGNMENT: '📝',
    GRADE: '📊',
    LESSON: '📅',
    MATERIAL: '📚',
    ANNOUNCEMENT: '📢',
    COURSE: '🎓',
    SCHEDULE: '🕐',
    SYSTEM: '⚙️',
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <div className="row space-between">
        <div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-sub">Непрочитанных: {data?.unreadCount || 0}</p>
        </div>
        <Button variant="secondary" onClick={markAll}>
          Прочитать все
        </Button>
      </div>
      {!data?.items.length && <EmptyState title="Уведомлений нет" />}
      <div className="stack">
        {data?.items.map((n) => (
          <div 
            className="card row space-between" 
            key={n.id}
            style={{ 
              background: !n.readAt ? 'linear-gradient(145deg, var(--brand-soft), #fff)' : '#fff',
              border: !n.readAt ? '2px solid var(--brand)' : '1px solid var(--border)'
            }}
          >
            <div style={{ flex: 1 }}>
              <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2rem' }}>{typeIcons[n.type] || '🔔'}</span>
                <strong>{n.title}</strong>
                {!n.readAt && <Badge tone="brand">новое</Badge>}
              </div>
              <p style={{ margin: '0.25rem 0' }}>{n.body}</p>
              <span className="hint">{formatDateTime(n.createdAt)}</span>
            </div>
            {!n.readAt && (
              <Button variant="ghost" onClick={() => markRead(n.id)}>
                Прочитано
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
