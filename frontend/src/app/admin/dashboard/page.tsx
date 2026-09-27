'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, formatDateTime, formatTimeRange, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';

type AdminDash = {
  users: { total: number; active: number };
  students: number;
  teachers: number;
  courses: { active: number; archived: number };
  groups: { current: number; completed: number };
  lessons: { today: number; week: number };
  assignments: { total: number; pendingReview: number };
  attendancePercent: number;
  averageGrade: number | null;
  teacherLoad: { id: string; name: string; photoUrl?: string | null; groups: number }[];
  applicationsPending: number;
  newsPublished: number;
  recentApplications: { id: string; createdAt: string; course: { id: string; title: string }; student: PersonRef }[];
  todayLessons: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    status: string;
    format: string;
    groupCode: string;
    courseTitle: string;
    teacher: PersonRef | null;
    place: string | null;
  }[];
  recentActions: { id: string; action: string; entityType: string; createdAt: string; user: { firstName: string; lastName: string; role: string } | null }[];
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'создал(а)',
  UPDATE: 'изменил(а)',
  DELETE: 'удалил(а)',
  ARCHIVE: 'архивировал(а)',
  ADD_STUDENT: 'добавил(а) студента в',
  REMOVE_STUDENT: 'исключил(а) студента из',
  UPDATE_PHOTO: 'обновил(а) фото:',
  CHANGE_PASSWORD: 'сменил(а) пароль:',
  CANCEL: 'отменил(а)',
};

const ENTITY_LABEL: Record<string, string> = {
  User: 'пользователя',
  Course: 'курс',
  Group: 'группу',
  Lesson: 'занятие',
  Assignment: 'задание',
  Material: 'материал',
  News: 'новость',
  PublicMaterial: 'материал сайта',
  SiteSetting: 'настройки сайта',
  CourseApplication: 'заявку',
  Announcement: 'объявление',
  Branch: 'филиал',
  Classroom: 'аудиторию',
  Grade: 'оценку',
  Submission: 'работу',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData<AdminDash>('/api/analytics/admin');
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const maxLoad = Math.max(1, ...data.teacherLoad.map((t) => t.groups));

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title={`Добро пожаловать, ${user?.firstName ?? 'администратор'}!`}
        subtitle="Состояние образовательного центра Somon"
        actions={
          <>
            <ButtonLink href="/admin/schedule" variant="secondary">
              Расписание
            </ButtonLink>
            <ButtonLink href="/admin/groups">+ Группа</ButtonLink>
          </>
        }
      />

      <div className="grid grid-4">
        <StatCard icon="🎓" label="Студенты" value={data.students} hint={`Пользователей: ${data.users.active} акт. из ${data.users.total}`} href="/admin/students" />
        <StatCard icon="🧑‍🏫" label="Преподаватели" value={data.teachers} tone="info" href="/admin/teachers" />
        <StatCard icon="📚" label="Курсы" value={data.courses.active} hint={`В архиве: ${data.courses.archived}`} tone="success" href="/admin/courses" />
        <StatCard icon="👥" label="Группы" value={data.groups.current} hint={`Завершено: ${data.groups.completed}`} tone="brand" href="/admin/groups" />
        <StatCard icon="🗓️" label="Занятия" value={data.lessons.today} hint={`сегодня · ${data.lessons.week} за 7 дней`} tone="info" href="/admin/schedule?view=day" />
        <StatCard
          icon="📨"
          label="Новые заявки"
          value={data.applicationsPending}
          tone={data.applicationsPending ? 'warning' : 'success'}
          href="/admin/applications"
        />
        <StatCard
          icon="📥"
          label="Работ на проверке"
          value={data.assignments.pendingReview}
          hint={`Заданий всего: ${data.assignments.total}`}
          tone={data.assignments.pendingReview ? 'warning' : 'success'}
          href="/admin/assignments"
        />
        <StatCard
          icon="✅"
          label="Посещаемость"
          value={`${data.attendancePercent}%`}
          hint={data.averageGrade != null ? `Средний балл: ${data.averageGrade} / 5` : undefined}
          tone="success"
          href="/admin/statistics"
        />
      </div>

      <div className="layout-2-1">
        <div className="stack">
          <section className="card">
            <div className="row space-between">
              <h2 className="card-title" style={{ margin: 0 }}>
                Занятия сегодня
              </h2>
              <Link href="/admin/schedule?view=day" className="text-link" style={{ fontSize: '0.88rem' }}>
                Календарь →
              </Link>
            </div>
            {!data.todayLessons.length ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Сегодня занятий нет.
              </p>
            ) : (
              data.todayLessons.map((l) => (
                <Link key={l.id} href={`/admin/schedule?lessonId=${l.id}`} className="list-row" style={{ opacity: l.status === 'CANCELLED' ? 0.6 : 1 }}>
                  <strong style={{ minWidth: 96 }}>{formatTimeRange(l.startsAt, l.endsAt)}</strong>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {l.courseTitle} · {l.groupCode}
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {l.title}
                      {l.teacher ? ` · ${fullName(l.teacher)}` : ''}
                      {l.place ? ` · ${l.place}` : ''}
                    </div>
                  </span>
                  {l.status === 'CANCELLED' ? (
                    <Badge tone="danger">Отменено</Badge>
                  ) : (
                    <Badge tone={l.format === 'ONLINE' ? 'success' : 'info'}>{l.format === 'ONLINE' ? '🟢 Онлайн' : '🔵 Офлайн'}</Badge>
                  )}
                </Link>
              ))
            )}
          </section>

          <section className="card">
            <div className="row space-between">
              <h2 className="card-title" style={{ margin: 0 }}>
                Новые заявки на курсы
              </h2>
              <Link href="/admin/applications" className="text-link" style={{ fontSize: '0.88rem' }}>
                Все заявки →
              </Link>
            </div>
            {!data.recentApplications.length ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Новых заявок нет.
              </p>
            ) : (
              data.recentApplications.map((a) => (
                <Link key={a.id} href="/admin/applications" className="list-row">
                  <Avatar user={a.student} size={32} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{fullName(a.student)}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {a.course.title}
                    </div>
                  </span>
                  <small className="muted">{formatDate(a.createdAt)}</small>
                </Link>
              ))
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h2 className="card-title">Нагрузка преподавателей</h2>
            {!data.teacherLoad.length ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Преподавателей пока нет.
              </p>
            ) : (
              <div className="stack" style={{ gap: '0.6rem' }}>
                {[...data.teacherLoad]
                  .sort((a, b) => b.groups - a.groups)
                  .map((t) => (
                    <div key={t.id} className="stack" style={{ gap: '0.25rem' }}>
                      <div className="row space-between" style={{ fontSize: '0.9rem' }}>
                        <span>{t.name}</span>
                        <strong>{t.groups} гр.</strong>
                      </div>
                      <ProgressBar value={Math.round((t.groups / maxLoad) * 100)} />
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Последние действия</h2>
            {!data.recentActions.length ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Журнал пуст.
              </p>
            ) : (
              <ul className="timeline">
                {data.recentActions.map((a) => (
                  <li key={a.id}>
                    <span style={{ fontSize: '0.88rem' }}>
                      <strong>{a.user ? fullName(a.user) : 'Система'}</strong> {ACTION_LABEL[a.action] ?? a.action.toLowerCase()}{' '}
                      {ENTITY_LABEL[a.entityType] ?? a.entityType}
                    </span>
                    <div className="muted" style={{ fontSize: '0.76rem' }}>
                      {formatDateTime(a.createdAt)}
                      {a.user ? ` · ${statusLabel[a.user.role] ?? a.user.role}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="card-title">Сайт</h2>
            <div className="stack" style={{ gap: '0.4rem' }}>
              <Link href="/admin/news" className="list-row">
                <span style={{ flex: 1 }}>📰 Опубликованных новостей</span>
                <strong>{data.newsPublished}</strong>
              </Link>
              <Link href="/admin/materials" className="list-row">
                <span style={{ flex: 1 }}>📚 Материалы сайта</span>
                <span className="muted">→</span>
              </Link>
              <Link href="/admin/settings" className="list-row">
                <span style={{ flex: 1 }}>⚙️ Контакты и тексты</span>
                <span className="muted">→</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
