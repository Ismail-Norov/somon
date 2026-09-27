'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Row = ProgressInfo & {
  course: { id: string; title: string; shortDesc?: string | null; category?: { name: string } | null };
  group: { id: string; code: string; status: string; format: string; startDate?: string | null; endDate?: string | null };
  teacher?: { user: PersonRef } | null;
  lessonsRemaining: number;
  nextLesson?: { id: string; title: string; startsAt: string } | null;
};

export default function StudentCoursesPage() {
  const { data, loading, error, reload } = useApiData<{ courses: Row[] }>('/api/analytics/student');

  return (
    <div>
      <PageHeader
        title="Мои курсы"
        subtitle="Курсы, на которых вы учитесь сейчас."
        actions={
          <ButtonLink href="/student/catalog" variant="secondary">
            Доступные курсы
          </ButtonLink>
        }
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.courses.length ? (
        <EmptyState
          icon="📚"
          title="Вы ещё не записаны на курсы"
          description="Выберите курс и подайте заявку — администратор добавит вас в группу."
          action={<ButtonLink href="/student/catalog">Выбрать курс</ButtonLink>}
        />
      ) : (
        <div className="grid grid-2">
          {data.courses.map((c) => (
            <article key={c.group.id} className="card course-progress-card">
              <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/student/courses/${c.course.id}`} className="text-link" style={{ fontSize: '1.1rem' }}>
                    {c.course.title}
                  </Link>
                  {c.course.shortDesc && <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>{c.course.shortDesc}</p>}
                </div>
                <Badge tone="brand">{c.group.code}</Badge>
              </div>
              <div className="row" style={{ gap: '0.4rem' }}>
                <Badge tone="info">{statusLabel[c.group.format] ?? c.group.format}</Badge>
                <Badge>{statusLabel[c.group.status] ?? c.group.status}</Badge>
                {c.group.startDate && (
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    {formatDate(c.group.startDate)} — {formatDate(c.group.endDate)}
                  </span>
                )}
              </div>
              {c.teacher && (
                <div className="row" style={{ gap: '0.5rem' }}>
                  <Avatar user={c.teacher.user} size={30} />
                  <span style={{ fontSize: '0.9rem' }}>{fullName(c.teacher.user)}</span>
                </div>
              )}
              <div>
                <div className="row space-between" style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span>Прогресс</span>
                  <strong>{Math.round(c.progressPercent)}%</strong>
                </div>
                <ProgressBar value={c.progressPercent} />
              </div>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Занятий {c.lessonsCompleted}/{c.lessonsTotal} · заданий {c.assignmentsDone}/{c.assignmentsTotal} · посещаемость{' '}
                {Math.round(c.attendancePercent)}%
              </div>
              {c.nextLesson && (
                <div style={{ fontSize: '0.88rem' }}>
                  🗓️ Следующее занятие: <strong>{formatDateTime(c.nextLesson.startsAt)}</strong>
                </div>
              )}
              <ButtonLink href={`/student/courses/${c.course.id}`} size="sm" variant="secondary">
                Открыть курс
              </ButtonLink>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
