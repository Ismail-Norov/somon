'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { formatDate, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type StudentRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  status: string;
  createdAt: string;
  phone?: string | null;
  studentId?: string;
  groups: { id: string; code: string; course: { id: string; title: string } }[];
};

type GroupOption = { id: string; code: string; status: string; capacity: number; course: { title: string }; _count: { groupStudents: number } };

const emptyCreate = { firstName: '', lastName: '', email: '', phone: '', password: 'Somon123!', groupId: '' };

export default function AdminStudentsPage() {
  const { data, loading, error, reload } = useApiData<StudentRow[]>('/api/users?role=STUDENT');
  const { data: groups, reload: reloadGroups } = useApiData<GroupOption[]>('/api/groups');
  const [q, setQ] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [create, setCreate] = useState<typeof emptyCreate | null>(null);
  const [addTo, setAddTo] = useState<{ student: StudentRow; groupId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const openGroups = (groups ?? []).filter((g) => g.status !== 'COMPLETED' && g.status !== 'ARCHIVED');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (status && s.status !== status) return false;
      if (groupFilter === 'none' && s.groups.length) return false;
      if (groupFilter && groupFilter !== 'none' && !s.groups.some((g) => g.id === groupFilter)) return false;
      return !needle || [s.firstName, s.lastName, s.email, s.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(needle));
    });
  }, [data, q, status, groupFilter]);

  const addToGroup = async (studentId: string, groupId: string) => {
    await api(`/api/groups/${groupId}/students`, { method: 'POST', json: { studentId } });
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!create) return;
    setSaving(true);
    setFormError('');
    try {
      const { groupId, ...rest } = create;
      const user = await api<{ studentId?: string }>('/api/users', {
        method: 'POST',
        json: { ...rest, firstName: rest.firstName.trim(), lastName: rest.lastName.trim(), email: rest.email.trim(), phone: rest.phone.trim(), role: 'STUDENT' },
      });
      let text = `Студент создан. Логин: ${rest.email.trim()}`;
      if (groupId && user.studentId) {
        try {
          await addToGroup(user.studentId, groupId);
          text += ', добавлен в группу.';
        } catch (err) {
          text += `. Не удалось добавить в группу: ${err instanceof ApiRequestError ? err.message : 'ошибка'}`;
        }
      }
      setMsg({ tone: 'success', text });
      setCreate(null);
      reload();
      reloadGroups();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось создать студента');
    } finally {
      setSaving(false);
    }
  };

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!addTo?.student.studentId || !addTo.groupId) return;
    setSaving(true);
    setFormError('');
    try {
      await addToGroup(addTo.student.studentId, addTo.groupId);
      setMsg({ tone: 'success', text: `${fullName(addTo.student)} добавлен(а) в группу. Студент получил уведомление.` });
      setAddTo(null);
      reload();
      reloadGroups();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось добавить в группу');
    } finally {
      setSaving(false);
    }
  };

  const setUserStatus = async (s: StudentRow, next: 'ACTIVE' | 'BLOCKED') => {
    try {
      await api(`/api/users/${s.id}`, { method: 'PATCH', json: { status: next } });
      setMsg({ tone: 'success', text: next === 'ACTIVE' ? `${fullName(s)} активирован(а).` : `${fullName(s)} заблокирован(а).` });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const groupOptions = (exclude: string[] = []) =>
    openGroups
      .filter((g) => !exclude.includes(g.id))
      .map((g) => {
        const full = g._count.groupStudents >= g.capacity;
        return (
          <option key={g.id} value={g.id} disabled={full}>
            {g.code} — {g.course.title} ({g._count.groupStudents}/{g.capacity}){full ? ' — мест нет' : ''}
          </option>
        );
      });

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Студенты"
        subtitle="Все студенты центра, их группы и успеваемость"
        actions={
          <>
            <ButtonLink href="/admin/applications" variant="secondary">
              Заявки на курсы
            </ButtonLink>
            <Button
              onClick={() => {
                setFormError('');
                setCreate(emptyCreate);
              }}
            >
              + Студент
            </Button>
          </>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, email, телефон" />
        </Field>
        <Field label="Группа">
          <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option value="">Все группы</option>
            <option value="none">Без группы</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.course.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Все</option>
            <option value="ACTIVE">Активные</option>
            <option value="BLOCKED">Заблокированные</option>
            <option value="ARCHIVED">Архив</option>
          </Select>
        </Field>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="🎓" title={data?.length ? 'Никого не найдено' : 'Студентов пока нет'} description="Студенты появляются после регистрации на сайте или создания администратором." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Телефон</th>
                <th>Группы</th>
                <th>Регистрация</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/students/${s.id}`} className="person-cell">
                      <Avatar user={s} size={38} />
                      <span>
                        <strong>{fullName(s)}</strong>
                        <small>{s.email}</small>
                      </span>
                    </Link>
                  </td>
                  <td>{s.phone || '—'}</td>
                  <td>
                    <div className="badge-row">
                      {s.groups.length ? (
                        s.groups.map((g) => (
                          <Badge key={g.id} tone="brand">
                            <span title={g.course.title}>{g.code}</span>
                          </Badge>
                        ))
                      ) : (
                        <span className="muted">нет</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDate(s.createdAt)}</td>
                  <td>
                    <Badge tone={s.status === 'ACTIVE' ? 'success' : s.status === 'BLOCKED' ? 'danger' : 'default'}>{statusLabel[s.status] ?? s.status}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <ButtonLink size="sm" variant="secondary" href={`/admin/students/${s.id}`}>
                        Открыть
                      </ButtonLink>
                      {s.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFormError('');
                            setAddTo({ student: s, groupId: '' });
                          }}
                        >
                          В группу
                        </Button>
                      )}
                      {s.status === 'ACTIVE' ? (
                        <Button size="sm" variant="ghost" onClick={() => setUserStatus(s, 'BLOCKED')}>
                          Заблокировать
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setUserStatus(s, 'ACTIVE')}>
                          Активировать
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(create)} title="Новый студент" onClose={() => !saving && setCreate(null)}>
        {create && (
          <form className="stack" onSubmit={submitCreate}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="form-grid">
              <Field label="Имя">
                <Input value={create.firstName} onChange={(e) => setCreate({ ...create, firstName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Фамилия">
                <Input value={create.lastName} onChange={(e) => setCreate({ ...create, lastName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Email (логин)">
                <Input type="email" value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} required />
              </Field>
              <Field label="Телефон">
                <Input type="tel" value={create.phone} onChange={(e) => setCreate({ ...create, phone: e.target.value })} />
              </Field>
              <Field label="Пароль" hint="Минимум 6 символов">
                <Input value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} required minLength={6} />
              </Field>
              <Field label="Сразу добавить в группу">
                <Select value={create.groupId} onChange={(e) => setCreate({ ...create, groupId: e.target.value })}>
                  <option value="">Не добавлять</option>
                  {groupOptions()}
                </Select>
              </Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setCreate(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Создаём...' : 'Создать'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(addTo)} title={addTo ? `Добавить в группу: ${fullName(addTo.student)}` : ''} onClose={() => !saving && setAddTo(null)}>
        {addTo && (
          <form className="stack" onSubmit={submitAdd}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <Field label="Группа">
              <Select value={addTo.groupId} onChange={(e) => setAddTo({ ...addTo, groupId: e.target.value })} required>
                <option value="">Выберите группу</option>
                {groupOptions(addTo.student.groups.map((g) => g.id))}
              </Select>
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setAddTo(null)} disabled={saving}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving || !addTo.groupId}>
                {saving ? 'Добавляем...' : 'Добавить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
