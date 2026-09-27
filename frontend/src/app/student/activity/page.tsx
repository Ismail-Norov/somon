'use client';

import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime } from '@/lib/format';

type Activity = {
  id: string;
  action: string;
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
};

export default function StudentActivityPage() {
  const { data, loading, error, reload } = useApiData<{ activities: Activity[] }>('/api/student/activity');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data?.activities.length) return <EmptyState title="Активности пока нет" />;

  const actionLabels: Record<string, string> = {
    SUBMISSION: '📝 Отправка задания',
    GRADE_RECEIVED: '📊 Получена оценка',
    ATTENDANCE: '📅 Посещение занятия',
    ENROLLMENT: '🎓 Запись на курс',
    COURSE_COMPLETED: '🏆 Курс завершен',
    ACHIEVEMENT: '🌟 Достижение',
    MATERIAL_VIEWED: '📚 Материал просмотрен',
    LESSON_PARTICIPATED: '👨‍🏫 Участие в занятии',
  };

  return (
    <div>
      <h1 className="page-title">История активности</h1>
      <p className="page-sub">Ваши действия и достижения</p>

      <div className="stack">
        {data.activities.map((activity) => (
          <div className="card" key={activity.id} style={{ padding: '1rem' }}>
            <div className="row space-between">
              <strong>{actionLabels[activity.action] || activity.action}</strong>
              <span className="hint">{formatDateTime(activity.createdAt)}</span>
            </div>
            <p style={{ margin: '0.5rem 0' }}>{activity.description}</p>
            {activity.metadata && (
              <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                {Object.entries(activity.metadata).map(([key, value]) => (
                  <div key={key}>
                    {key}: {String(value)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}