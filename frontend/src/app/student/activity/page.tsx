'use client';

import { useMemo } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { ActivityItem } from '@/lib/types';
import { formatDateLong, formatTime } from '@/lib/format';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

const ICONS: Record<string, string> = {
  LOGIN: '🔑',
  SUBMISSION: '📤',
  SUBMISSION_RETURNED: '↩️',
  GRADE: '⭐',
  ATTENDANCE: '✅',
  MATERIAL_VIEW: '📖',
  MATERIAL_DOWNLOAD: '⬇️',
  VIDEO_OPEN: '▶️',
  LINK_OPEN: '🔗',
  APPLICATION: '🧾',
};

function dayKey(iso: string) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function dayTitle(key: string) {
  const d = new Date(key);
  const today = new Date();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (d.getTime() === t) return 'Сегодня';
  if (d.getTime() === t - 86400000) return 'Вчера';
  return formatDateLong(d);
}

export default function StudentActivityPage() {
  const { data, loading, error, reload } = useApiData<ActivityItem[]>('/api/student/activity');

  const groups = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    (data ?? []).forEach((a) => {
      const k = dayKey(a.createdAt);
      map.set(k, [...(map.get(k) ?? []), a]);
    });
    return [...map.entries()];
  }, [data]);

  return (
    <div>
      <PageHeader title="Активность" subtitle="Ваши входы, отправленные работы, оценки, посещения и открытые материалы." />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !groups.length ? (
        <EmptyState icon="🕒" title="Активности пока нет" description="Здесь появятся ваши действия в системе." />
      ) : (
        <div className="card">
          {groups.map(([key, items]) => (
            <div key={key}>
              <div className="timeline-day">{dayTitle(key)}</div>
              <ul className="timeline">
                {items.map((a) => (
                  <li key={a.id}>
                    <div className="row space-between">
                      <span>
                        <span aria-hidden>{ICONS[a.type] ?? '•'}</span> {a.title}
                      </span>
                      <small className="muted">{formatTime(a.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
