'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Group = {
  id: string;
  code: string;
  name?: string | null;
  status: string;
  format: string;
  capacity: number;
  courseId: string;
  teacherId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  adminNote?: string | null;
  course: { id: string; title: string };
  teacher?: { id: string; user: PersonRef } | null;
  _count: { groupStudents: number };
};

type GroupDetail = Group & { groupStudents: { id: string; joinedAt: string; student: { id: string; user: PersonRef } }[] };
type Course = { id: string; title: string; status: string };
type TeacherOption = { id: string; user: PersonRef & { status: string } };
type StudentUser = { id: string; studentId?: string; firstName: string; lastName: string; email: string; status: string };

type GroupForm = {
  id?: string;
  code: string;
  name: string;
  courseId: string;
  teacherId: string;
  capacity: string;
  status: string;
  format: string;
  startDate: string;
  endDate: string;
  adminNote: string;
};

const emptyForm: GroupForm = {
  code: '',
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '12',
  status: 'ENROLLMENT',
  format: 'OFFLINE',
  startDate: '',
  endDate: '',
  adminNote: '',
};

const STATUS_TONE: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  ACTIVE: 'success',
  ENROLLMENT: 'info',
  PLANNED: 'warning',
  COMPLETED: 'default',
  ARCHIVED: 'default',
};

const toDateInput = (v?: string | null) => (v ? v.slice(0, 10) : '');
const fromDateInput = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : null);

export default function AdminGroupsPage() {
  const { data, loading, error, reload } = useApiData<Group[]>('/api/groups');
  const { data: courses } = useApiData<Course[]>('/api/courses');
  const { data: teachers } = useApiData<TeacherOption[]>('/api/teachers');
  const { data: students } = useApiData<StudentUser[]>('/api/users?role=STUDENT&status=ACTIVE');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [form, setForm] = useState<GroupForm | null>(null);
  const [membersOf, setMembersOf] = useState<GroupDetail | null>(null);
  const [addStudentId, setAddStudentId] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((g) => {
      if (status && g.status !== status) return false;
      if (courseFilter && g.courseId !== courseFilter) return false;
      return !needle || [g.code, g.name, g.course.title, g.teacher ? fullName(g.teacher.user) : ''].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [data, q, status, courseFilter]);

  const openEdit = (g: Group) => {
    setFormError('');
    setForm({
      id: g.id,
      code: g.code,
      name: g.name ?? '',
      courseId: g.courseId,
      teacherId: g.teacherId ?? '',
      capacity: String(g.capacity),
      status: g.status,
      format: g.format,
      startDate: toDateInput(g.startDate),
      endDate: toDateInput(g.endDate),
      adminNote: g.adminNote ?? '',
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity <= 0) return setFormError('Вместимость — целое положительное число.');
    setSaving(true);
    setFormError('');
    const json = {
      code: form.code.trim(),
      name: form.name.trim() || form.code.trim(),
      courseId: form.courseId,
      teacherId: form.teacherId || null,
      capacity,
      status: form.status,
      format: form.format,
      startDate: fromDateInput(form.startDate),
      endDate: fromDateInput(form.endDate),
      adminNote: form.adminNote.trim() || null,
    };
    try {
      await api(form.id ? `/api/groups/${form.id}` : '/api/groups', { method: form.id ? 'PATCH' : 'POST', json });
      setMsg({ tone: 'success', text: form.id ? 'Группа сохранена.' : 'Группа создана. Теперь добавьте студентов и занятия в расписание.' });
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const openMembers = async (groupId: string) => {
    setFormError('');
    setAddStudentId('');
    setRemoveId(null);
    try {
      setMembersOf(await api<GroupDetail>(`/api/groups/${groupId}`));
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось открыть группу' });
    }
  };

  const changeMembers = async (fn: () => Promise<unknown>) => {
    if (!membersOf) return;
    setSaving(true);
    setFormError('');
    try {
      await fn();
      setMembersOf(await api<GroupDetail>(`/api/groups/${membersOf.id}`));
      setAddStudentId('');
      setRemoveId(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось выполнить действие');
    } finally {
      setSaving(false);
    }
  };

  const memberIds = new Set(membersOf?.groupStudents.map((gs) => gs.student.id));
  const candidates = (students ?? []).filter((s) => s.studentId && !memberIds.has(s.studentId));
  const isFull = membersOf ? membersOf.groupStudents.length >= membersOf.capacity : false;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Группы"
        subtitle="Формирование учебных групп: курс, преподаватель, состав и сроки"
        actions={
          <Button
            onClick={() => {
              setFormError('');
              setForm({ ...emptyForm, courseId: courseFilter });
            }}
          >
            + Группа
          </Button>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Код, курс, преподаватель" />
        </Field>
        <Field label="Курс">
          <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="">Все курсы</option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            {['PLANNED', 'ENROLLMENT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="👥" title={data?.length ? 'Ничего не найдено' : 'Групп пока нет'} description="Создайте группу, назначьте преподавателя и добавьте студентов." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Группа</th>
                <th>Курс</th>
                <th>Преподаватель</th>
                <th>Студенты</th>
                <th>Период</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.code}</strong>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>
                      {statusLabel[g.format] ?? g.format}
                      {g.name && g.name !== g.code ? ` · ${g.name}` : ''}
                    </div>
                  </td>
                  <td>{g.course.title}</td>
                  <td>
                    {g.teacher ? (
                      <span className="person-cell" style={{ minWidth: 0 }}>
                        <Avatar user={g.teacher.user} size={28} />
                        {fullName(g.teacher.user)}
                      </span>
                    ) : (
                      <Badge tone="warning">Не назначен</Badge>
                    )}
                  </td>
                  <td>
                    <Badge tone={g._count.groupStudents >= g.capacity ? 'danger' : 'default'}>
                      {g._count.groupStudents}/{g.capacity}
                    </Badge>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {g.startDate ? `${formatDate(g.startDate)} — ${formatDate(g.endDate)}` : '—'}
                  </td>
                  <td>
                    <Badge tone={STATUS_TONE[g.status] ?? 'default'}>{statusLabel[g.status] ?? g.status}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button size="sm" variant="secondary" onClick={() => openMembers(g.id)}>
                        Состав
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                        Изменить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(form)} size="lg" title={form?.id ? `Группа ${form.code}` : 'Новая группа'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="form-grid">
              <Field label="Код группы">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={40} placeholder="WEB-101" />
              </Field>
              <Field label="Название">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Как код, если пусто" />
              </Field>
              <Field label="Курс">
                <Select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })} required>
                  <option value="">Выберите курс</option>
                  {(courses ?? [])
                    .filter((c) => c.status !== 'ARCHIVED' || c.id === form.courseId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Преподаватель" hint="Получит уведомление о назначении">
                <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
                  <option value="">Не назначен</option>
                  {(teachers ?? [])
                    .filter((t) => t.user.status === 'ACTIVE' || t.id === form.teacherId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {fullName(t.user)}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Вместимость">
                <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
              </Field>
              <Field label="Формат">
                <Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>
                  <option value="OFFLINE">Офлайн</option>
                  <option value="ONLINE">Онлайн</option>
                  <option value="HYBRID">Смешанный</option>
                </Select>
              </Field>
              <Field label="Статус">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {['PLANNED', 'ENROLLMENT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].map((s) => (
                    <option key={s} value={s}>
                      {statusLabel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Начало">
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Field>
              <Field label="Окончание">
                <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Field>
            </div>
            <Field label="Заметка администратора" hint="Видна только администраторам">
              <Textarea rows={2} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(membersOf)} size="lg" title={membersOf ? `Состав группы ${membersOf.code}` : ''} onClose={() => !saving && setMembersOf(null)}>
        {membersOf && (
          <div className="stack">
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <span className="muted">
                {membersOf.course.title} · {membersOf.groupStudents.length} из {membersOf.capacity} мест
              </span>
              <ButtonLink size="sm" variant="ghost" href="/admin/schedule">
                Расписание →
              </ButtonLink>
            </div>
            {membersOf.groupStudents.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                В группе пока нет студентов.
              </p>
            ) : (
              <ul className="list-plain">
                {membersOf.groupStudents.map((gs) => (
                  <li key={gs.id} className="list-row">
                    <Link href={`/admin/students/${gs.student.user.id}`} className="person-cell" style={{ flex: 1 }}>
                      <Avatar user={gs.student.user} size={32} />
                      <span>
                        <strong>{fullName(gs.student.user)}</strong>
                        <small>
                          {gs.student.user.email} · с {formatDate(gs.joinedAt)}
                        </small>
                      </span>
                    </Link>
                    {removeId === gs.student.id ? (
                      <>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={saving}
                          onClick={() => changeMembers(() => api(`/api/groups/${membersOf.id}/students/${gs.student.id}`, { method: 'DELETE' }))}
                        >
                          Исключить
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRemoveId(null)} disabled={saving}>
                          Отмена
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRemoveId(gs.student.id)}>
                        Исключить
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Field label="Добавить студента" hint={isFull ? 'Группа заполнена — увеличьте вместимость в настройках группы' : 'Студент получит уведомление'}>
              <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
                <Select value={addStudentId} onChange={(e) => setAddStudentId(e.target.value)} disabled={isFull}>
                  <option value="">Выберите студента</option>
                  {candidates.map((s) => (
                    <option key={s.id} value={s.studentId}>
                      {fullName(s)} — {s.email}
                    </option>
                  ))}
                </Select>
                <Button
                  disabled={!addStudentId || saving || isFull}
                  onClick={() => changeMembers(() => api(`/api/groups/${membersOf.id}/students`, { method: 'POST', json: { studentId: addStudentId } }))}
                >
                  Добавить
                </Button>
              </div>
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
