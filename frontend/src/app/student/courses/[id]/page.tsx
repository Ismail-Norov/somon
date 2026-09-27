'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Assignment, LessonCard, Material, PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, formatDateTime, fullName, statusLabel } from '@/lib/format';
import { studentAssignmentState } from '@/lib/assignments';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { LessonCardView } from '@/components/cabinet/LessonCard';
import { MaterialCard } from '@/components/cabinet/MaterialCard';
import { ProgressBreakdown } from '@/components/cabinet/ProgressBreakdown';

type Detail = {
  course: { id: string; title: string; shortDesc?: string | null; description?: string | null };
  group: { id: string; code: string; status: string; format: string; startDate?: string | null; endDate?: string | null };
  teacher?: { position?: string | null; specialization?: string | null; user: PersonRef } | null;
  lessons: LessonCard[];
  materials: Material[];
  assignments: Assignment[];
  grades: {
    id: string;
    score: number;
    maxScore: number;
    comment?: string | null;
    updatedAt: string;
    submission?: { assignment: { id: string; title: string } } | null;
    lesson?: { title: string } | null;
  }[];
  attendance: { id: string; status: string; note?: string | null; lesson: { title: string; startsAt: string } }[];
  attendanceSummary: { total: number; present: number; absent: number; late: number; excused: number; percent: number };
  announcements: { id: string; title: string; body: string; createdAt: string; author: PersonRef }[];
  progress: ProgressInfo;
  nextLesson: LessonCard | null;
};

type Tab = 'overview' | 'lessons' | 'assignments' | 'materials' | 'grades' | 'attendance' | 'announcements';

const ATT_TONE: Record<string, 'success' | 'warning' | 'info' | 'danger'> = {
  PRESENT: 'success',
  LATE: 'warning',
  EXCUSED: 'info',
  ABSENT: 'danger',
};

export default function StudentCourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<Detail>(`/api/analytics/student/course/${id}`);
  const [tab, setTab] = useState<Tab>('overview');

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Курс недоступен'} onRetry={reload} />;

  const p = data.progress;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Обзор' },
    { key: 'lessons', label: 'Занятия', count: data.lessons.length },
    { key: 'assignments', label: 'Задания', count: data.assignments.length },
    { key: 'materials', label: 'Материалы', count: data.materials.length },
    { key: 'grades', label: 'Оценки', count: data.grades.length },
    { key: 'attendance', label: 'Посещаемость' },
    { key: 'announcements', label: 'Объявления', count: data.announcements.length },
  ];

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/student/courses', label: 'Назад к курсам' }}
        title={data.course.title}
        subtitle={`Группа ${data.group.code} · ${statusLabel[data.group.format] ?? data.group.format}${
          data.group.startDate ? ` · ${formatDate(data.group.startDate)} — ${formatDate(data.group.endDate)}` : ''
        }`}
        actions={<Badge tone="brand">Прогресс {Math.round(p.progressPercent)}%</Badge>}
      />

      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count ? <span className="muted"> ({t.count})</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="layout-2-1">
          <div className="stack" style={{ gap: '1rem' }}>
            <section className="card">
              <h2 className="card-title">Ближайшее занятие</h2>
              {data.nextLesson ? <LessonCardView lesson={data.nextLesson} /> : <p className="muted">Запланированных занятий нет.</p>}
            </section>
            <section className="card">
              <h2 className="card-title">О курсе</h2>
              <p className="pre-wrap">{data.course.description || data.course.shortDesc || 'Описание курса скоро появится.'}</p>
            </section>
          </div>
          <div className="stack" style={{ gap: '1rem' }}>
            <section className="card">
              <h2 className="card-title">Прогресс по курсу</h2>
              <ProgressBreakdown
                overall={p.progressPercent}
                lessons={p.lessonsPercent}
                assignments={p.assignmentsPercent}
                attendance={p.attendancePercent}
                details={{
                  lessons: `Проведено ${p.lessonsCompleted} из ${p.lessonsTotal}`,
                  assignments: `Сдано ${p.assignmentsDone} из ${p.assignmentsTotal}`,
                  attendance: p.attendanceMarked ? `Посещено ${p.attendancePresent} из ${p.attendanceMarked}` : 'Отметок пока нет',
                }}
              />
            </section>
            {data.teacher && (
              <section className="card">
                <h2 className="card-title">Преподаватель</h2>
                <div className="row">
                  <Avatar user={data.teacher.user} size={52} />
                  <div>
                    <strong>{fullName(data.teacher.user)}</strong>
                    <div className="muted" style={{ fontSize: '0.85rem' }}>
                      {data.teacher.position || data.teacher.specialization || 'Преподаватель'}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'lessons' && (
        <section className="card">
          {data.lessons.length ? (
            data.lessons.map((l) => <LessonCardView key={l.id} lesson={l} />)
          ) : (
            <EmptyState icon="🗓️" title="Занятия ещё не запланированы" />
          )}
        </section>
      )}

      {tab === 'assignments' &&
        (data.assignments.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Задание</th>
                  <th>Срок</th>
                  <th>Статус</th>
                  <th>Оценка</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.assignments.map((a) => {
                  const s = studentAssignmentState(a);
                  return (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/student/assignments/${a.id}`} className="text-link">
                          {a.title}
                        </Link>
                      </td>
                      <td>{a.deadline ? formatDateTime(a.deadline) : 'Без срока'}</td>
                      <td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td>{s.sub?.grade ? `${s.sub.grade.score}/${s.sub.grade.maxScore}` : '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <ButtonLink href={`/student/assignments/${a.id}`} size="sm" variant={s.key === 'active' ? 'primary' : 'secondary'}>
                          {s.key === 'active' ? 'Сдать' : 'Открыть'}
                        </ButtonLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="📝" title="Заданий пока нет" />
        ))}

      {tab === 'materials' &&
        (data.materials.length ? (
          <div className="grid grid-2">
            {data.materials.map((m) => (
              <MaterialCard key={m.id} material={{ ...m, course: m.course ?? { id: data.course.id, title: data.course.title } }} href={`/student/materials/${m.id}`} track />
            ))}
          </div>
        ) : (
          <EmptyState icon="📂" title="Материалов пока нет" />
        ))}

      {tab === 'grades' &&
        (data.grades.length ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>За что</th>
                  <th>Оценка</th>
                  <th>Комментарий</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {data.grades.map((g) => (
                  <tr key={g.id}>
                    <td>{g.submission?.assignment.title ?? `Занятие: ${g.lesson?.title ?? '—'}`}</td>
                    <td>
                      <Badge tone={g.score / g.maxScore >= 0.8 ? 'success' : g.score / g.maxScore >= 0.6 ? 'warning' : 'danger'}>
                        {g.score}/{g.maxScore}
                      </Badge>
                    </td>
                    <td className="pre-wrap">{g.comment || '—'}</td>
                    <td>{formatDate(g.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="⭐" title="Оценок пока нет" />
        ))}

      {tab === 'attendance' && (
        <div className="stack">
          <div className="card row" style={{ gap: '1.5rem' }}>
            <span>
              Посещаемость: <strong>{Math.round(data.attendanceSummary.percent)}%</strong>
            </span>
            <span>Присутствовал: {data.attendanceSummary.present - data.attendanceSummary.late - data.attendanceSummary.excused}</span>
            <span>Опоздания: {data.attendanceSummary.late}</span>
            <span>Уважительные: {data.attendanceSummary.excused}</span>
            <span>Пропуски: {data.attendanceSummary.absent}</span>
          </div>
          {data.attendance.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Занятие</th>
                    <th>Статус</th>
                    <th>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance.map((a) => (
                    <tr key={a.id}>
                      <td>{formatDateTime(a.lesson.startsAt)}</td>
                      <td>{a.lesson.title}</td>
                      <td>
                        <Badge tone={ATT_TONE[a.status] ?? 'default'}>{statusLabel[a.status] ?? a.status}</Badge>
                      </td>
                      <td>{a.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="✅" title="Отметок пока нет" />
          )}
        </div>
      )}

      {tab === 'announcements' &&
        (data.announcements.length ? (
          <div className="stack">
            {data.announcements.map((a) => (
              <article key={a.id} className="card">
                <div className="row space-between">
                  <strong>{a.title}</strong>
                  <small className="muted">{formatDateTime(a.createdAt)}</small>
                </div>
                <p className="pre-wrap" style={{ margin: '0.4rem 0' }}>{a.body}</p>
                <small className="muted">{fullName(a.author)}</small>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon="📢" title="Объявлений пока нет" />
        ))}
    </div>
  );
}
