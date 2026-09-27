'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Material, PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, formatDateTime, formatTimeRange, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';
import { MaterialCard } from '@/components/cabinet/MaterialCard';
import { AnnouncementsPanel } from '@/components/cabinet/AnnouncementsPanel';

type GroupData = {
  group: {
    id: string;
    code: string;
    status: string;
    format: string;
    capacity: number;
    startDate?: string | null;
    endDate?: string | null;
    course: { id: string; title: string };
    groupStudents: { id: string; joinedAt: string; student: { id: string; phone?: string | null; user: PersonRef }; progress: ProgressInfo | null }[];
    lessons: {
      id: string;
      title: string;
      startsAt: string;
      endsAt: string;
      status: string;
      format: string;
      room?: string | null;
      branch?: { name: string } | null;
      classroom?: { name: string } | null;
    }[];
    assignments: { id: string; title: string; deadline?: string | null; status: string; maxScore: number; _count: { submissions: number } }[];
  };
  analytics: { averageGrade: number | null; attendancePercent: number; progressPercent: number; gradesCount: number };
  materials: Material[];
};

type Tab = 'students' | 'lessons' | 'assignments' | 'materials' | 'announcements';

export default function TeacherGroupPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<GroupData>(`/api/analytics/teacher/group/${id}`);
  const [tab, setTab] = useState<Tab>('students');

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Группа не найдена'} onRetry={reload} />;

  const { group, analytics } = data;
  const students = group.groupStudents;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'students', label: 'Студенты', count: students.length },
    { key: 'lessons', label: 'Занятия', count: group.lessons.length },
    { key: 'assignments', label: 'Задания', count: group.assignments.length },
    { key: 'materials', label: 'Материалы', count: data.materials.length },
    { key: 'announcements', label: 'Объявления' },
  ];

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/teacher/groups', label: 'Назад к группам' }}
        title={`Группа ${group.code}`}
        subtitle={`${group.course.title} · ${statusLabel[group.format] ?? group.format}${
          group.startDate ? ` · ${formatDate(group.startDate)} — ${formatDate(group.endDate)}` : ''
        }`}
        actions={
          <>
            <ButtonLink href={`/teacher/attendance?groupId=${group.id}`} variant="secondary">
              Посещаемость
            </ButtonLink>
            <ButtonLink href={`/teacher/grades?groupId=${group.id}`} variant="secondary">
              Журнал оценок
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-4">
        <StatCard icon="🎓" label="Студентов" value={`${students.length} / ${group.capacity}`} />
        <StatCard icon="📈" label="Средний прогресс" value={`${Math.round(analytics.progressPercent)}%`} tone="info" />
        <StatCard icon="✅" label="Посещаемость" value={`${Math.round(analytics.attendancePercent)}%`} tone="success" />
        <StatCard icon="⭐" label="Средний балл" value={analytics.averageGrade !== null ? `${analytics.averageGrade} / 5` : '—'} tone="warning" />
      </div>

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
            {t.count !== undefined && <span className="muted"> ({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === 'students' &&
        (students.length === 0 ? (
          <EmptyState icon="🎓" title="В группе пока нет студентов" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Студент</th>
                  <th>Email</th>
                  <th style={{ minWidth: 160 }}>Прогресс</th>
                  <th>Посещаемость</th>
                  <th>Средний балл</th>
                  <th>Задания</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {students.map((gs) => {
                  const p = gs.progress;
                  return (
                    <tr key={gs.id}>
                      <td>
                        <Link href={`/teacher/groups/${group.id}/students/${gs.student.id}`} className="row" style={{ gap: '0.6rem' }}>
                          <Avatar user={gs.student.user} size={36} />
                          <strong>{fullName(gs.student.user)}</strong>
                        </Link>
                      </td>
                      <td>{gs.student.user.email}</td>
                      <td>
                        <div className="stack" style={{ gap: '0.25rem' }}>
                          <ProgressBar value={p?.progressPercent ?? 0} />
                          <small>{Math.round(p?.progressPercent ?? 0)}%</small>
                        </div>
                      </td>
                      <td>
                        {p?.attendanceMarked ? (
                          <Badge tone={p.attendancePercent >= 85 ? 'success' : p.attendancePercent >= 70 ? 'warning' : 'danger'}>
                            {Math.round(p.attendancePercent)}%
                          </Badge>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{p?.averageGrade ?? '—'}</td>
                      <td>
                        {p ? `${p.assignmentsDone}/${p.assignmentsTotal}` : '—'}
                        {p?.overdueAssignments ? (
                          <div>
                            <Badge tone="danger">Просрочено: {p.overdueAssignments}</Badge>
                          </div>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <ButtonLink href={`/teacher/groups/${group.id}/students/${gs.student.id}`} size="sm" variant="secondary">
                          Профиль
                        </ButtonLink>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'lessons' &&
        (group.lessons.length === 0 ? (
          <EmptyState icon="🗓️" title="Занятия ещё не запланированы" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Тема</th>
                  <th>Формат / место</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.lessons.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {formatDate(l.startsAt)}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {formatTimeRange(l.startsAt, l.endsAt)}
                      </div>
                    </td>
                    <td>{l.title}</td>
                    <td>
                      {statusLabel[l.format] ?? l.format}
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {[l.branch?.name, l.classroom?.name ?? l.room].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td>
                      <Badge tone={l.status === 'COMPLETED' ? 'success' : l.status === 'CANCELLED' ? 'danger' : 'info'}>
                        {statusLabel[l.status] ?? l.status}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {l.status !== 'CANCELLED' && new Date(l.startsAt) <= new Date(Date.now() + 86400000) && (
                        <ButtonLink href={`/teacher/attendance?lessonId=${l.id}`} size="sm" variant="secondary">
                          Отметить
                        </ButtonLink>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'assignments' && (
        <div className="stack">
          <div>
            <ButtonLink href={`/teacher/assignments?create=1&groupId=${group.id}`}>+ Новое задание</ButtonLink>
          </div>
          {group.assignments.length === 0 ? (
            <EmptyState icon="📝" title="Заданий пока нет" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Задание</th>
                    <th>Срок</th>
                    <th>Статус</th>
                    <th>Сдали</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {group.assignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/teacher/assignments/${a.id}`} className="text-link">
                          {a.title}
                        </Link>
                      </td>
                      <td>{a.deadline ? formatDateTime(a.deadline) : 'Без срока'}</td>
                      <td>
                        <Badge tone={a.status === 'DRAFT' ? 'default' : a.status === 'OVERDUE' ? 'warning' : 'success'}>
                          {a.status === 'OVERDUE' ? 'Срок прошёл' : statusLabel[a.status] ?? a.status}
                        </Badge>
                      </td>
                      <td>
                        {a._count.submissions} / {students.length}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <ButtonLink href={`/teacher/assignments/${a.id}`} size="sm" variant="secondary">
                          Ответы
                        </ButtonLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'materials' && (
        <div className="stack">
          <div>
            <ButtonLink href={`/teacher/materials?create=1&groupId=${group.id}`}>+ Добавить материал</ButtonLink>
          </div>
          {data.materials.length === 0 ? (
            <EmptyState icon="📂" title="Материалов пока нет" />
          ) : (
            <div className="grid grid-2">
              {data.materials.map((m) => (
                <MaterialCard key={m.id} material={m} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && <AnnouncementsPanel groups={[{ id: group.id, code: group.code }]} fixedGroupId={group.id} />}
    </div>
  );
}
