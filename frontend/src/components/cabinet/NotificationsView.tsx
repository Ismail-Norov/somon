'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { emitNotificationsChanged } from '@/lib/events';
import { useApiData } from '@/lib/useApiData';
import type { NotificationItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

const ICONS: Record<string, string> = {
  ASSIGNMENT: '📝',
  SUBMISSION: '📤',
  GRADE: '⭐',
  LESSON: '🗓️',
  SCHEDULE: '🕐',
  MATERIAL: '📚',
  ANNOUNCEMENT: '📢',
  ATTENDANCE: '✅',
  COURSE: '🎓',
  APPLICATION: '🧾',
  SYSTEM: '⚙️',
};

type Payload = { items: NotificationItem[]; unreadCount: number };

export function NotificationsView() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, error, reload, setData } = useApiData<Payload>(`/api/notifications${unreadOnly ? '?unread=true' : ''}`);

  const markLocal = (id?: string) => {
    setData((d) =>
      d
        ? {
            unreadCount: id ? Math.max(0, d.unreadCount - (d.items.find((n) => n.id === id && !n.readAt) ? 1 : 0)) : 0,
            items: d.items.map((n) => (!id || n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)),
          }
        : d
    );
    emitNotificationsChanged();
  };

  const markRead = async (id: string) => {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => undefined);
    markLocal(id);
  };

  const markAll = async () => {
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => undefined);
    markLocal();
  };

  const open = async (n: NotificationItem) => {
    if (!n.readAt) await markRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div>
      <PageHeader
        title="Уведомления"
        subtitle={data ? (data.unreadCount ? `Непрочитанных: ${data.unreadCount}` : 'Все уведомления прочитаны') : undefined}
        actions={
          <>
            <div className="segmented">
              <button type="button" className={!unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(false)}>
                Все
              </button>
              <button type="button" className={unreadOnly ? 'active' : ''} onClick={() => setUnreadOnly(true)}>
                Непрочитанные
              </button>
            </div>
            <Button variant="secondary" onClick={markAll} disabled={!data?.unreadCount}>
              Прочитать все
            </Button>
          </>
        }
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.items.length ? (
        <EmptyState icon="🔔" title={unreadOnly ? 'Непрочитанных уведомлений нет' : 'Уведомлений пока нет'} />
      ) : (
        <div className="stack">
          {data.items.map((n) => (
            <div key={n.id} className={`notification ${n.readAt ? '' : 'unread'}`}>
              <span className="notification-icon" aria-hidden>
                {ICONS[n.type] ?? '🔔'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: '0.5rem' }}>
                  <strong>{n.title}</strong>
                  {!n.readAt && <Badge tone="brand">Новое</Badge>}
                </div>
                {n.body && <p style={{ margin: '0.2rem 0' }}>{n.body}</p>}
                <small className="muted">{formatDateTime(n.createdAt)}</small>
              </div>
              <div className="row" style={{ gap: '0.35rem' }}>
                {n.link && (
                  <Button size="sm" variant="secondary" onClick={() => open(n)}>
                    Открыть
                  </Button>
                )}
                {!n.readAt && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                    Прочитано
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
