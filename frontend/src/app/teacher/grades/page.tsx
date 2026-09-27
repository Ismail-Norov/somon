'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef, ProgressInfo } from '@/lib/types';
import { formatDate, fullName } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type GroupOption = { id: string; code: string; course: { title: string } };
type GroupData = {
  group: {
    id: string;
    code: string;
    groupStudents: { student: { id: string; user: PersonRef }; progress: ProgressInfo | null }[];
    lessons: { id: string; title: string; startsAt: string; status: string }[];
    assignments: { id: string; title: string; deadline?: string | null; status: string; maxScore: number }[];
  };
};
type SubmissionRow = { id: string; status: string; submittedAt?: string | null; student: { id: string }; assignment: { id: string }; grade?: { score: number; maxScore: number } | null };
type LessonGrade = { id: string; score: number; maxScore: number; comment?: string | null; studentId: string; lesson?: { id: string; title: string; startsAt: string } | null };

function Cell({ sub, deadline, maxScore }: { sub?: SubmissionRow; deadline?: string | null; maxScore: number }) {
  if (!sub || !sub.submittedAt) {
    const overdue = Boolean(deadline && new Date(deadline) < new Date());
    return <span className={overdue ? 'error-text' : 'muted'} title={overdue ? 'Не сдано, срок прошёл' : 'Не сдано'}>{overdue ? '✕' : '—'}</span>;
  }
  const content =
    sub.status === 'GRADED' && sub.grade ? (
      <strong title="Оценено">{`${sub.grade.score}/${sub.grade.maxScore ?? maxScore}`}</strong>
    ) : sub.status === 'RETURNED' ? (
      <span title="На доработке">↩</span>
    ) : (
      <span className="badge badge-info" title="Ждёт проверки">
        проверить
      </span>
    );
  return (
    <Link href={`/teacher/review/${sub.id}`} className="text-link">
      {content}
    </Link>
  );
}

function GradesInner() {
  const params = useSearchParams();
  const groups = useApiData<GroupOption[]>('/api/groups');
  const [groupId, setGroupId] = useState(params.get('groupId') ?? '');
  const data = useApiData<GroupData>(groupId ? `/api/analytics/teacher/group/${groupId}` : null);
  const subs = useApiData<SubmissionRow[]>(groupId ? `/api/assignments/submissions/review?status=all&groupId=${groupId}` : null);
  const grades = useApiData<LessonGrade[]>(groupId ? `/api/grades?groupId=${groupId}` : null);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ studentId: '', lessonId: '', score: '5', comment: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!groupId && groups.data?.length) setGroupId(groups.data[0].id);
  }, [groups.data, groupId]);

  const subMap = useMemo(() => {
    const m = new Map<string, SubmissionRow>();
    for (const s of subs.data ?? []) m.set(`${s.student.id}:${s.assignment.id}`, s);
    return m;
  }, [subs.data]);

  const lessonGrades = useMemo(() => {
    const m = new Map<string, LessonGrade[]>();
    for (const g of grades.data ?? []) {
      if (!g.lesson) continue;
      m.set(g.studentId, [...(m.get(g.studentId) ?? []), g]);
    }
    return m;
  }, [grades.data]);

  const assignments = (data.data?.group.assignments ?? []).filter((a) => a.status !== 'DRAFT');
  const students = data.data?.group.groupStudents ?? [];
  const pastLessons = (data.data?.group.lessons ?? []).filter((l) => l.status !== 'CANCELLED' && new Date(l.startsAt) <= new Date());

  const openModal = () => {
    setForm({ studentId: students[0]?.student.id ?? '', lessonId: pastLessons[pastLessons.length - 1]?.id ?? '', score: '5', comment: '' });
    setModal(true);
  };

  const saveLessonGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const score = Number(form.score);
    if (!Number.isFinite(score) || score < 0 || score > 5) return setMsg({ tone: 'error', text: 'Оценка за занятие — от 0 до 5' });
    setSaving(true);
    try {
      await api('/api/grades', {
        method: 'POST',
        json: { studentId: form.studentId, lessonId: form.lessonId, score, maxScore: 5, comment: form.comment.trim() || null },
      });
      setModal(false);
      setMsg({ tone: 'success', text: 'Оценка выставлена, студент получил уведомление' });
      grades.reload();
      data.reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось сохранить оценку' });
    } finally {
      setSaving(false);
    }
  };

  const loading = data.loading || subs.loading || grades.loading;
  const error = data.error || subs.error || grades.error;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Журнал оценок"
        subtitle="Оценки студентов по заданиям и занятиям"
        back={{ href: '/teacher/dashboard', label: 'Назад на главную' }}
        actions={
          <Button onClick={openModal} disabled={!students.length || !pastLessons.length}>
            + Оценка за занятие
          </Button>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {groups.loading ? (
        <LoadingState />
      ) : !groups.data?.length ? (
        <EmptyState icon="👥" title="У вас пока нет групп" />
      ) : (
        <div style={{ maxWidth: 320 }}>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Группа">
            {groups.data.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} · {g.course.title}
              </option>
            ))}
          </Select>
        </div>
      )}

      {groupId &&
        (loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              data.reload();
              subs.reload();
              grades.reload();
            }}
          />
        ) : !students.length ? (
          <EmptyState icon="🎓" title="В группе нет студентов" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data journal">
                <thead>
                  <tr>
                    <th>Студент</th>
                    {assignments.map((a) => (
                      <th key={a.id} title={a.title}>
                        <Link href={`/teacher/assignments/${a.id}`} className="text-link">
                          {a.title.length > 18 ? `${a.title.slice(0, 18)}…` : a.title}
                        </Link>
                        <div style={{ textTransform: 'none', fontWeight: 400 }}>{a.deadline ? formatDate(a.deadline) : 'без срока'}</div>
                      </th>
                    ))}
                    <th>За занятия</th>
                    <th>Средний (из 5)</th>
                    <th>Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(({ student, progress }) => {
                    const lg = lessonGrades.get(student.id) ?? [];
                    return (
                      <tr key={student.id}>
                        <td>
                          <Link href={`/teacher/groups/${groupId}/students/${student.id}`} className="row" style={{ gap: '0.5rem' }}>
                            <Avatar user={student.user} size={30} />
                            <span>{fullName(student.user)}</span>
                          </Link>
                        </td>
                        {assignments.map((a) => (
                          <td key={a.id}>
                            <Cell sub={subMap.get(`${student.id}:${a.id}`)} deadline={a.deadline} maxScore={a.maxScore} />
                          </td>
                        ))}
                        <td title={lg.map((g) => `${g.lesson?.title}: ${g.score}/${g.maxScore}`).join('\n')}>
                          {lg.length ? lg.map((g) => g.score).join(', ') : <span className="muted">—</span>}
                        </td>
                        <td>
                          <strong>{progress?.averageGrade ?? '—'}</strong>
                        </td>
                        <td>{Math.round(progress?.progressPercent ?? 0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              «проверить» — работа ждёт проверки, ↩ — возвращена на доработку, ✕ — не сдана в срок. Нажмите на ячейку, чтобы открыть работу.
            </p>
          </>
        ))}

      <Modal open={modal} title="Оценка за занятие" onClose={() => !saving && setModal(false)}>
        <form className="stack" onSubmit={saveLessonGrade}>
          <Field label="Студент">
            <Select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required>
              {students.map(({ student }) => (
                <option key={student.id} value={student.id}>
                  {fullName(student.user)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Занятие">
            <Select value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: e.target.value })} required>
              {pastLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {formatDate(l.startsAt)} · {l.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Оценка (0–5)">
            <Input type="number" min={0} max={5} step="0.5" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
          </Field>
          <Field label="Комментарий">
            <Textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={5000} />
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => setModal(false)} disabled={saving}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving || !form.studentId || !form.lessonId}>
              {saving ? 'Сохраняем...' : 'Выставить'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function TeacherGradesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <GradesInner />
    </Suspense>
  );
}
