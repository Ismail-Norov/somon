'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { formatDate, formatDateTime, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Group = {
  id: string;
  code: string;
  name?: string | null;
  status: string;
  format: string;
  startDate?: string | null;
  endDate?: string | null;
  capacity: number;
  course: { id: string; title: string };
  _count: { groupStudents: number };
  nextLesson?: { id: string; title: string; startsAt: string } | null;
  summary: { students: number; progressPercent: number; attendancePercent: number; averageGrade: number | null; assignmentsMissing: number };
};

export default function TeacherGroupsPage() {
  const { data, loading, error, reload } = useApiData<Group[]>('/api/groups');

  return (
    <div>
      <PageHeader title="Мои группы" subtitle="Группы, которые вы ведёте: состав, прогресс и посещаемость." />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState icon="👥" title="У вас пока нет групп" description="Администратор назначит вас преподавателем группы." />
      ) : (
        <div className="grid grid-2">
          {data.map((g) => (
            <article key={g.id} className="card stack" style={{ gap: '0.65rem' }}>
              <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <Link href={`/teacher/groups/${g.id}`} className="text-link" style={{ fontSize: '1.15rem' }}>
                    {g.code}
                  </Link>
                  <div className="muted">{g.course.title}</div>
                </div>
                <div className="row" style={{ gap: '0.35rem' }}>
                  <Badge tone={g.status === 'ACTIVE' ? 'success' : 'info'}>{statusLabel[g.status] ?? g.status}</Badge>
                  <Badge>{statusLabel[g.format] ?? g.format}</Badge>
                </div>
              </div>
              <div className="muted" style={{ fontSize: '0.88rem' }}>
                Студентов: {g._count.groupStudents} из {g.capacity}
                {g.startDate ? ` · ${formatDate(g.startDate)} — ${formatDate(g.endDate)}` : ''}
              </div>
              <div>
                <div className="row space-between" style={{ fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                  <span>Средний прогресс</span>
                  <strong>{Math.round(g.summary.progressPercent)}%</strong>
                </div>
                <ProgressBar value={g.summary.progressPercent} />
              </div>
              <div className="row" style={{ gap: '1rem', fontSize: '0.88rem' }}>
                <span>✅ Посещаемость {Math.round(g.summary.attendancePercent)}%</span>
                <span>⭐ Балл {g.summary.averageGrade ?? '—'}</span>
                {g.summary.assignmentsMissing > 0 && <span className="muted">Несданных работ: {g.summary.assignmentsMissing}</span>}
              </div>
              {g.nextLesson && (
                <div style={{ fontSize: '0.88rem' }}>
                  🗓️ Ближайшее: <strong>{g.nextLesson.title}</strong>, {formatDateTime(g.nextLesson.startsAt)}
                </div>
              )}
              <div className="row">
                <ButtonLink href={`/teacher/groups/${g.id}`} size="sm">
                  Открыть группу
                </ButtonLink>
                <ButtonLink href={`/teacher/attendance?groupId=${g.id}`} size="sm" variant="secondary">
                  Посещаемость
                </ButtonLink>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
