'use client';

import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import type { LessonCard, NotificationItem, PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, formatDateTime, fullName, plural } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatCard } from '@/components/cabinet/StatCard';
import { LessonCardView } from '@/components/cabinet/LessonCard';
import { ProgressBreakdown } from '@/components/cabinet/ProgressBreakdown';

type CourseRow = ProgressInfo & {
  course: { id: string; title: string };
  group: { id: string; code: string; status: string };
  teacher?: { user: PersonRef } | null;
  lessonsRemaining: number;
};

type PendingAssignment = {
  id: string;
  title: string;
  deadline?: string | null;
  maxScore: number;
  isOverdue: boolean;
  course: { title: string };
  group: { code: string };
  submission?: { status: string } | null;
};

type Dash = {
  greeting: string;
  stats: {
    activeCourses: number;
    averageGrade: number | null;
    attendancePercent: number;
    progressPercent: number;
    activeAssignments: number;
    overdueAssignments: number;
    unreadNotifications: number;
    lessonsVisited: number;
    lessonsMarked: number;
    assignmentsDone: number;
    assignmentsTotal: number;
  };
  courses: CourseRow[];
  nextLesson: LessonCard | null;
  upcomingLessons: LessonCard[];
  pendingAssignments: PendingAssignment[];
  recentGrades: {
    id: string;
    score: number;
    maxScore: number;
    comment?: string | null;
    updatedAt: string;
    submission?: { assignment: { id: string; title: string; course: { title: string } } } | null;
    lesson?: { title: string } | null;
  }[];
  progress: { overall: number; lessons: number; assignments: number; attendance: number };
  notifications: NotificationItem[];
  announcements: { id: string; title: string; body: string; createdAt: string; group: { code: string }; author: PersonRef }[];
};

function greetingByTime() {
  const h = new Date().getHours();
  if (h < 6) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function deadlineLabel(deadline?: string | null) {
  if (!deadline) return 'Без срока';
  const diff = new Date(deadline).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (diff < 0) return 'Срок прошёл';
  if (days <= 1) return 'Сдать сегодня/завтра';
  return `Осталось ${days} ${plural(days, ['день', 'дня', 'дней'])}`;
}

export default function StudentDashboard() {
  const { data, loading, error, reload } = useApiData<Dash>('/api/analytics/student');

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { stats } = data;
  const next = data.nextLesson;

  return (
    <div className="stack" style={{ gap: '1.25rem' }}>
      <div className="card welcome-card">
        <h1 className="page-title">
          {greetingByTime()}, {data.greeting}!
        </h1>
        <p>
          {stats.activeAssignments > 0
            ? `У вас ${stats.activeAssignments} ${plural(stats.activeAssignments, ['активное задание', 'активных задания', 'активных заданий'])}${
                stats.overdueAssignments ? `, из них просрочено: ${stats.overdueAssignments}` : ''
              }.`
            : 'Все задания сданы — отличная работа!'}{' '}
          {next ? `Ближайшее занятие — ${formatDateTime(next.startsAt)}.` : ''}
        </p>
      </div>

      <div className="grid grid-3">
        <StatCard icon="📚" label="Активные курсы" value={stats.activeCourses} href="/student/courses" />
        <StatCard
          icon="⭐"
          label="Средний балл"
          value={stats.averageGrade !== null ? `${stats.averageGrade} / 5` : '—'}
          hint={stats.averageGrade === null ? 'Оценок пока нет' : undefined}
          tone="warning"
          href="/student/grades"
        />
        <StatCard
          icon="✅"
          label="Посещаемость"
          value={`${Math.round(stats.attendancePercent)}%`}
          hint={stats.lessonsMarked ? `${stats.lessonsVisited} из ${stats.lessonsMarked} занятий` : 'Отметок пока нет'}
          tone="success"
          href="/student/attendance"
        />
        <StatCard
          icon="📈"
          label="Общий прогресс"
          value={`${Math.round(stats.progressPercent)}%`}
          tone="info"
          href="/student/progress"
        />
        <StatCard
          icon="📝"
          label="Активные задания"
          value={stats.activeAssignments}
          hint={stats.overdueAssignments ? `Просрочено: ${stats.overdueAssignments}` : `Сдано ${stats.assignmentsDone} из ${stats.assignmentsTotal}`}
          tone={stats.overdueAssignments ? 'danger' : 'brand'}
          href="/student/assignments"
        />
        <StatCard
          icon="🔔"
          label="Непрочитанные уведомления"
          value={stats.unreadNotifications}
          tone="info"
          href="/student/notifications"
        />
      </div>

      <div className="layout-2-1">
        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Ближайшее занятие</h2>
              <Link href="/student/schedule" className="text-link">
                Всё расписание
              </Link>
            </div>
            {next ? (
              <LessonCardView lesson={next} />
            ) : (
              <EmptyState icon="🗓️" title="Ближайших занятий нет" description="Когда появится расписание, занятие отобразится здесь." />
            )}
            {data.upcomingLessons.length > 1 && (
              <>
                <h3 style={{ fontSize: '0.95rem', marginTop: '1rem' }}>Далее</h3>
                {data.upcomingLessons.slice(1, 4).map((l) => (
                  <LessonCardView key={l.id} lesson={l} compact />
                ))}
              </>
            )}
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Активные задания</h2>
              <Link href="/student/assignments" className="text-link">
                Все задания
              </Link>
            </div>
            {data.pendingAssignments.length === 0 ? (
              <EmptyState icon="🎉" title="Нет активных заданий" description="Новые задания появятся здесь, как только преподаватель их опубликует." />
            ) : (
              <ul className="list-plain">
                {data.pendingAssignments.map((a) => (
                  <li key={a.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/student/assignments/${a.id}`} className="text-link">
                        {a.title}
                      </Link>
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {a.course.title} · {a.group.code} · до {formatDateTime(a.deadline)}
                      </div>
                    </div>
                    <div className="row" style={{ gap: '0.4rem' }}>
                      {a.submission?.status === 'RETURNED' && <Badge tone="warning">На доработку</Badge>}
                      <Badge tone={a.isOverdue ? 'danger' : 'info'}>{deadlineLabel(a.deadline)}</Badge>
                      <ButtonLink href={`/student/assignments/${a.id}`} size="sm">
                        Сдать
                      </ButtonLink>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Мои курсы</h2>
              <Link href="/student/catalog" className="text-link">
                Доступные курсы
              </Link>
            </div>
            {data.courses.length === 0 ? (
              <EmptyState
                icon="📚"
                title="Вы пока не записаны на курсы"
                description="Выберите курс и отправьте заявку — администратор добавит вас в группу."
                action={<ButtonLink href="/student/catalog">Выбрать курс</ButtonLink>}
              />
            ) : (
              <div className="grid grid-2">
                {data.courses.map((c) => (
                  <Link key={c.group.id} href={`/student/courses/${c.course.id}`} className="card course-progress-card stat-card-link">
                    <div className="row space-between">
                      <strong>{c.course.title}</strong>
                      <Badge tone="brand">{c.group.code}</Badge>
                    </div>
                    {c.teacher && <span className="muted" style={{ fontSize: '0.85rem' }}>Преподаватель: {fullName(c.teacher.user)}</span>}
                    <ProgressBar value={c.progressPercent} />
                    <div className="row space-between" style={{ fontSize: '0.85rem' }}>
                      <span>Прогресс {Math.round(c.progressPercent)}%</span>
                      <span className="muted">
                        Занятий {c.lessonsCompleted}/{c.lessonsTotal} · заданий {c.assignmentsDone}/{c.assignmentsTotal}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="stack" style={{ gap: '1rem' }}>
          <section className="card">
            <h2 className="card-title">Мой прогресс</h2>
            <ProgressBreakdown
              overall={data.progress.overall}
              lessons={data.progress.lessons}
              assignments={data.progress.assignments}
              attendance={data.progress.attendance}
            />
            <Link href="/student/progress" className="text-link" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
              Подробнее по курсам →
            </Link>
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Последние оценки</h2>
              <Link href="/student/grades" className="text-link">
                Все
              </Link>
            </div>
            {data.recentGrades.length === 0 ? (
              <p className="muted">Оценок пока нет.</p>
            ) : (
              <ul className="list-plain">
                {data.recentGrades.map((g) => (
                  <li key={g.id} className="list-row">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{g.submission?.assignment.title ?? g.lesson?.title ?? 'Оценка'}</div>
                      <small className="muted">{formatDate(g.updatedAt)}</small>
                    </div>
                    <Badge tone={g.score / g.maxScore >= 0.8 ? 'success' : g.score / g.maxScore >= 0.6 ? 'warning' : 'danger'}>
                      {g.score}/{g.maxScore}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title">Уведомления</h2>
              <Link href="/student/notifications" className="text-link">
                Все
              </Link>
            </div>
            {data.notifications.length === 0 ? (
              <p className="muted">Новых уведомлений нет.</p>
            ) : (
              <ul className="list-plain">
                {data.notifications.map((n) => (
                  <li key={n.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: n.readAt ? 500 : 700 }}>{n.title}</div>
                      {n.body && <small className="muted">{n.body}</small>}
                    </div>
                    {!n.readAt && <Badge tone="brand">Новое</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {data.announcements.length > 0 && (
            <section className="card">
              <h2 className="card-title">Объявления группы</h2>
              <ul className="list-plain">
                {data.announcements.map((a) => (
                  <li key={a.id} className="list-row" style={{ display: 'block' }}>
                    <div className="row space-between">
                      <strong>{a.title}</strong>
                      <Badge>{a.group.code}</Badge>
                    </div>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>{a.body}</p>
                    <small className="muted">
                      {fullName(a.author)} · {formatDate(a.createdAt)}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
