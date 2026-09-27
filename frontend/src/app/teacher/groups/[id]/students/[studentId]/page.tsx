'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import type { ActivityItem, PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { ProgressBreakdown } from '@/components/cabinet/ProgressBreakdown';
import { StatCard } from '@/components/cabinet/StatCard';

type StudentCard = {
  group: { id: string; code: string; courseId: string };
  student: { id: string; phone?: string | null; user: PersonRef & { createdAt?: string }; joinedAt: string; status: string };
  progress: ProgressInfo | null;
  attendance: { id: string; status: string; note?: string | null; lesson: { id: string; title: string; startsAt: string } }[];
  assignments: {
    id: string;
    title: string;
    deadline?: string | null;
    maxScore: number;
    submission: {
      id: string;
      status: string;
      submittedAt?: string | null;
      attemptCount: number;
      grade?: { score: number; maxScore: number; comment?: string | null } | null;
    } | null;
  }[];
  lessonGrades: { id: string; score: number; maxScore: number; comment?: string | null; lesson?: { title: string; startsAt: string } | null }[];
  activities: ActivityItem[];
};

const ATTENDANCE_TONE: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  PRESENT: 'success',
  ABSENT: 'danger',
  LATE: 'warning',
  EXCUSED: 'info',
};

function submissionBadge(a: StudentCard['assignments'][number]) {
  const s = a.submission;
  if (s?.grade) return <Badge tone="success">{`${s.grade.score} / ${s.grade.maxScore}`}</Badge>;
  if (s && ['SUBMITTED', 'REVIEWING'].includes(s.status)) return <Badge tone="info">На проверке</Badge>;
  if (s?.status === 'RETURNED') return <Badge tone="warning">На доработке</Badge>;
  if (a.deadline && new Date(a.deadline) < new Date()) return <Badge tone="danger">Не сдано, срок прошёл</Badge>;
  return <Badge>Не сдано</Badge>;
}

export default function TeacherStudentCardPage() {
  const { id, studentId } = useParams<{ id: string; studentId: string }>();
  const { data, loading, error, reload } = useApiData<StudentCard>(`/api/groups/${id}/students/${studentId}`);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Студент не найден'} onRetry={reload} />;

  const { student, progress: p, group } = data;
  const user = student.user;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader back={{ href: `/teacher/groups/${group.id}`, label: `Назад к группе ${group.code}` }} title="Карточка студента" />

      <div className="card row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <Avatar user={user} size={72} />
        <div className="stack" style={{ gap: '0.25rem', flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0 }}>{fullName(user)}</h2>
          <span className="muted">{user.email}</span>
          {student.phone && <span className="muted">{student.phone}</span>}
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            В группе {group.code} с {formatDate(student.joinedAt)}
          </span>
        </div>
        <Badge tone={student.status === 'ACTIVE' ? 'success' : 'default'}>{statusLabel[student.status] ?? student.status}</Badge>
      </div>

      <div className="grid grid-4">
        <StatCard icon="📈" label="Прогресс" value={`${Math.round(p?.progressPercent ?? 0)}%`} tone="info" />
        <StatCard icon="✅" label="Посещаемость" value={p?.attendanceMarked ? `${Math.round(p.attendancePercent)}%` : '—'} tone="success" />
        <StatCard icon="⭐" label="Средний балл" value={p?.averageGrade != null ? `${p.averageGrade} / 5` : '—'} tone="warning" />
        <StatCard
          icon="📝"
          label="Задания"
          value={p ? `${p.assignmentsDone} / ${p.assignmentsTotal}` : '—'}
          hint={p?.overdueAssignments ? `Просрочено: ${p.overdueAssignments}` : undefined}
          tone={p?.overdueAssignments ? 'danger' : 'brand'}
        />
      </div>

      <div className="layout-2-1">
        <div className="stack">
          <section className="card">
            <h2 className="card-title">Задания</h2>
            {data.assignments.length === 0 ? (
              <EmptyState icon="📝" title="Заданий пока нет" />
            ) : (
              data.assignments.map((a) => (
                <div key={a.id} className="list-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{a.title}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {a.deadline ? `Срок: ${formatDateTime(a.deadline)}` : 'Без срока'}
                      {a.submission?.submittedAt && ` · сдано ${formatDateTime(a.submission.submittedAt)}`}
                      {a.submission && a.submission.attemptCount > 1 && ` · попыток: ${a.submission.attemptCount}`}
                    </div>
                  </div>
                  {submissionBadge(a)}
                  {a.submission && (
                    <Link href={`/teacher/review/${a.submission.id}`} className="text-link" style={{ fontSize: '0.85rem' }}>
                      Открыть
                    </Link>
                  )}
                </div>
              ))
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Посещаемость</h2>
            {data.attendance.length === 0 ? (
              <EmptyState icon="🗓️" title="Отметок пока нет" />
            ) : (
              data.attendance.map((r) => (
                <div key={r.id} className="list-row">
                  <div style={{ flex: 1 }}>
                    <strong>{r.lesson.title}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {formatDateTime(r.lesson.startsAt)}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <Badge tone={ATTENDANCE_TONE[r.status] ?? 'default'}>{statusLabel[r.status] ?? r.status}</Badge>
                </div>
              ))
            )}
          </section>

          {data.lessonGrades.length > 0 && (
            <section className="card">
              <h2 className="card-title">Оценки за занятия</h2>
              {data.lessonGrades.map((g) => (
                <div key={g.id} className="list-row">
                  <div style={{ flex: 1 }}>
                    <strong>{g.lesson?.title ?? 'Занятие'}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {g.lesson && formatDate(g.lesson.startsAt)}
                      {g.comment && ` · ${g.comment}`}
                    </div>
                  </div>
                  <Badge tone="success">{`${g.score} / ${g.maxScore}`}</Badge>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="stack">
          <section className="card">
            <h2 className="card-title">Прогресс</h2>
            <ProgressBreakdown
              overall={p?.progressPercent ?? 0}
              lessons={p?.lessonsPercent ?? 0}
              assignments={p?.assignmentsPercent ?? 0}
              attendance={p?.attendancePercent ?? 0}
              details={
                p
                  ? {
                      lessons: `${p.lessonsCompleted} из ${p.lessonsTotal} занятий`,
                      assignments: `${p.assignmentsDone} из ${p.assignmentsTotal} заданий`,
                      attendance: `${p.attendancePresent} из ${p.attendanceMarked} отмеченных занятий`,
                    }
                  : undefined
              }
            />
          </section>

          <section className="card">
            <h2 className="card-title">Последняя активность</h2>
            {data.activities.length === 0 ? (
              <p className="muted">Активности пока нет</p>
            ) : (
              <ul className="timeline">
                {data.activities.map((a) => (
                  <li key={a.id}>
                    <strong style={{ fontSize: '0.9rem' }}>{a.title}</strong>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      {formatDateTime(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
