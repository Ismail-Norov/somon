'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Assignment, PersonRef, Submission } from '@/lib/types';
import { formatDateTime, fullName } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';
import { SingleFile } from '@/components/cabinet/Files';

type Detail = Assignment & { students: { id: string; user: PersonRef }[]; submissions: Submission[] };
type Filter = 'all' | 'review' | 'graded' | 'missing';

type Row = { student: { id: string; user: PersonRef }; submission: Submission | null };

function rowState(r: Row, deadline?: string | null) {
  const s = r.submission;
  if (!s || !s.submittedAt || s.status === 'DRAFT') {
    const overdue = Boolean(deadline && new Date(deadline) < new Date());
    return { key: 'missing' as const, badge: <Badge tone={overdue ? 'danger' : 'default'}>{overdue ? 'Не сдано, срок прошёл' : 'Не сдано'}</Badge> };
  }
  if (s.status === 'GRADED' && s.grade) return { key: 'graded' as const, badge: <Badge tone="success">{`${s.grade.score} / ${s.grade.maxScore}`}</Badge> };
  if (s.status === 'RETURNED') return { key: 'review' as const, badge: <Badge tone="warning">На доработке</Badge> };
  return { key: 'review' as const, badge: <Badge tone="info">{s.status === 'REVIEWING' ? 'Проверяется' : 'Ждёт проверки'}</Badge> };
}

export default function TeacherAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<Detail>(`/api/assignments/${id}`);
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const byStudent = new Map(data.submissions.map((s) => [s.studentId, s]));
    const list: Row[] = data.students.map((st) => ({ student: st, submission: byStudent.get(st.id) ?? null }));
    for (const s of data.submissions) {
      if (!data.students.some((st) => st.id === s.studentId) && s.student) list.push({ student: s.student, submission: s });
    }
    return list;
  }, [data]);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Задание не найдено'} onRetry={reload} />;

  const states = rows.map((r) => ({ r, st: rowState(r, data.deadline) }));
  const count = (k: Filter) => (k === 'all' ? states.length : states.filter((x) => x.st.key === k).length);
  const visible = filter === 'all' ? states : states.filter((x) => x.st.key === filter);

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/teacher/assignments', label: 'Назад к заданиям' }}
        title={data.title}
        subtitle={`${data.course?.title ?? ''}${data.group ? ` · ${data.group.code}` : ''}${data.lesson ? ` · ${data.lesson.title}` : ''}`}
        actions={
          data.group ? (
            <ButtonLink href={`/teacher/groups/${data.group.id}`} variant="secondary">
              К группе
            </ButtonLink>
          ) : undefined
        }
      />

      <div className="grid grid-4">
        <StatCard icon="🎓" label="Студентов" value={count('all')} />
        <StatCard icon="📥" label="Ждут проверки" value={count('review')} tone="info" />
        <StatCard icon="✅" label="Проверено" value={count('graded')} tone="success" />
        <StatCard icon="⏳" label="Не сдали" value={count('missing')} tone={count('missing') ? 'warning' : 'brand'} />
      </div>

      <div className="layout-2-1">
        <div className="stack">
          <div className="segmented" role="tablist">
            {(
              [
                ['all', 'Все'],
                ['review', 'На проверке'],
                ['graded', 'Проверено'],
                ['missing', 'Не сдали'],
              ] as [Filter, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={filter === k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>
                {label} ({count(k)})
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon="📭" title="Здесь пока пусто" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Студент</th>
                    <th>Отправлено</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map(({ r, st }) => {
                    const s = r.submission;
                    const late = Boolean(s?.submittedAt && data.deadline && new Date(s.submittedAt) > new Date(data.deadline));
                    return (
                      <tr key={r.student.id}>
                        <td>
                          <div className="row" style={{ gap: '0.6rem' }}>
                            <Avatar user={r.student.user} size={34} />
                            <strong>{fullName(r.student.user)}</strong>
                          </div>
                        </td>
                        <td>
                          {s?.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                          <div className="row" style={{ gap: '0.3rem', marginTop: '0.2rem' }}>
                            {late && <Badge tone="warning">С опозданием</Badge>}
                            {s && s.attemptCount > 1 && <Badge>{`Попыток: ${s.attemptCount}`}</Badge>}
                          </div>
                        </td>
                        <td>{st.badge}</td>
                        <td style={{ textAlign: 'right' }}>
                          {s && st.key !== 'missing' && (
                            <ButtonLink href={`/teacher/review/${s.id}`} size="sm" variant={st.key === 'graded' ? 'secondary' : 'primary'}>
                              {st.key === 'graded' ? 'Открыть' : 'Проверить'}
                            </ButtonLink>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section className="card stack">
          <h2 className="card-title">О задании</h2>
          <dl className="kv">
            <dt>Срок сдачи</dt>
            <dd>{data.deadline ? formatDateTime(data.deadline) : 'Без срока'}</dd>
            <dt>Публикация</dt>
            <dd>{data.status === 'DRAFT' ? 'Черновик' : data.publishAt ? formatDateTime(data.publishAt) : 'Сразу'}</dd>
            <dt>Макс. балл</dt>
            <dd>{data.maxScore}</dd>
            <dt>Пересдача</dt>
            <dd>{data.allowResubmit ? 'Разрешена' : 'Запрещена'}</dd>
          </dl>
          {data.description && <p className="pre-wrap" style={{ margin: 0 }}>{data.description}</p>}
          {data.criteria && (
            <div>
              <strong style={{ fontSize: '0.9rem' }}>Критерии оценки</strong>
              <p className="pre-wrap muted" style={{ margin: '0.2rem 0 0' }}>{data.criteria}</p>
            </div>
          )}
          {data.attachmentUrl && <SingleFile name={data.attachmentName || 'Инструкция'} path={`/api/files/assignment/${data.id}`} />}
          <ButtonLink href={`/teacher/assignments?groupId=${data.groupId ?? ''}`} variant="ghost" size="sm">
            Изменить в списке заданий
          </ButtonLink>
        </section>
      </div>
    </div>
  );
}
