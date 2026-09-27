'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type TeacherRow = {
  id: string;
  userId: string;
  specialization?: string | null;
  position?: string | null;
  phone?: string | null;
  bio?: string | null;
  isPublic: boolean;
  user: PersonRef & { id: string; email: string; status: string };
  groups: { id: string; code: string; status: string; course: { id: string; title: string }; _count: { groupStudents: number } }[];
  courses: { id: string; title: string; status: string }[];
  upcomingLessons: number;
};

type CourseOption = { id: string; title: string; status: string };
type GroupOption = { id: string; code: string; status: string; course: { id: string; title: string }; teacherId?: string | null; teacher?: { user: PersonRef } | null };

type TeacherForm = {
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  position: string;
  specialization: string;
  bio: string;
  isPublic: boolean;
  courseIds: string[];
  photoUrl?: string | null;
};

const emptyForm: TeacherForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: 'Somon123!',
  phone: '',
  position: '',
  specialization: '',
  bio: '',
  isPublic: true,
  courseIds: [],
};

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function AdminTeachersPage() {
  const { data, loading, error, reload, setData: setTeachers } = useApiData<TeacherRow[]>('/api/teachers');
  const { data: courses } = useApiData<CourseOption[]>('/api/courses');
  const { data: groups, reload: reloadGroups } = useApiData<GroupOption[]>('/api/groups');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [form, setForm] = useState<TeacherForm | null>(null);
  const [groupsFor, setGroupsFor] = useState<TeacherRow | null>(null);
  const [assignGroupId, setAssignGroupId] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'archive'; teacher: TeacherRow } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((t) => {
      if (status && t.user.status !== status) return false;
      if (!needle) return true;
      return [t.user.firstName, t.user.lastName, t.user.email, t.specialization, t.position]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [data, q, status]);

  const refreshAll = () => {
    reload();
    reloadGroups();
  };

  const openEdit = (t: TeacherRow) => {
    setFormError('');
    setForm({
      userId: t.userId,
      firstName: t.user.firstName,
      lastName: t.user.lastName,
      email: t.user.email ?? '',
      password: '',
      phone: t.phone ?? '',
      position: t.position ?? '',
      specialization: t.specialization ?? '',
      bio: t.bio ?? '',
      isPublic: t.isPublic,
      courseIds: t.courses.map((c) => c.id),
      photoUrl: t.user.photoUrl,
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError('');
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      position: form.position.trim(),
      specialization: form.specialization.trim(),
      bio: form.bio.trim(),
      isPublic: form.isPublic,
      courseIds: form.courseIds,
      ...(form.password ? { password: form.password } : {}),
    };
    try {
      if (form.userId) {
        await api(`/api/users/${form.userId}`, { method: 'PATCH', json: payload });
        setMsg({ tone: 'success', text: 'Данные преподавателя сохранены.' });
      } else {
        await api('/api/users', { method: 'POST', json: { ...payload, role: 'TEACHER' } });
        setMsg({ tone: 'success', text: `Преподаватель создан. Логин: ${payload.email}` });
      }
      setForm(null);
      refreshAll();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file?: File) => {
    if (photoRef.current) photoRef.current.value = '';
    if (!file || !form?.userId) return;
    if (!PHOTO_TYPES.includes(file.type)) return setFormError('Выберите изображение JPG, PNG, GIF или WEBP.');
    if (file.size > 5 * 1024 * 1024) return setFormError('Размер фото не должен превышать 5 МБ.');
    setSaving(true);
    setFormError('');
    try {
      const body = new FormData();
      body.append('photo', file);
      const res = await api<{ photoUrl: string }>(`/api/users/${form.userId}/photo`, { method: 'POST', body });
      setForm({ ...form, photoUrl: res.photoUrl });
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось загрузить фото');
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    if (!form?.userId) return;
    setSaving(true);
    try {
      await api(`/api/users/${form.userId}/photo`, { method: 'DELETE' });
      setForm({ ...form, photoUrl: null });
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось удалить фото');
    } finally {
      setSaving(false);
    }
  };

  const setUserStatus = async (t: TeacherRow, next: 'ACTIVE' | 'BLOCKED') => {
    try {
      await api(`/api/users/${t.userId}`, { method: 'PATCH', json: { status: next } });
      setMsg({ tone: 'success', text: next === 'ACTIVE' ? `${fullName(t.user)} активирован(а).` : `${fullName(t.user)} заблокирован(а).` });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, teacher } = confirm;
    setSaving(true);
    try {
      if (kind === 'delete') {
        await api(`/api/users/${teacher.userId}`, { method: 'DELETE' });
        setMsg({ tone: 'success', text: 'Преподаватель удалён.' });
      } else {
        await api(`/api/users/${teacher.userId}/archive`, { method: 'PATCH' });
        setMsg({ tone: 'success', text: 'Преподаватель перемещён в архив.' });
      }
      setConfirm(null);
      refreshAll();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'USER_HAS_DATA') {
        setConfirm({ kind: 'archive', teacher });
        setMsg({ tone: 'warning', text: err.message });
      } else {
        setConfirm(null);
        setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось выполнить действие' });
      }
    } finally {
      setSaving(false);
    }
  };

  const setGroupTeacher = async (groupId: string, teacherId: string | null) => {
    setSaving(true);
    setFormError('');
    try {
      await api(`/api/groups/${groupId}`, { method: 'PATCH', json: { teacherId } });
      setAssignGroupId('');
      const [teachers] = await Promise.all([api<TeacherRow[]>('/api/teachers'), reloadGroups()]);
      setTeachers(teachers);
      setGroupsFor((cur) => (cur ? teachers.find((t) => t.id === cur.id) ?? null : null));
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось изменить группу');
    } finally {
      setSaving(false);
    }
  };

  const assignable = (groups ?? []).filter(
    (g) => g.teacherId !== groupsFor?.id && g.status !== 'ARCHIVED' && g.status !== 'COMPLETED'
  );

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Преподаватели"
        subtitle="Профили, курсы и группы преподавателей. Публичные профили отображаются на сайте Somon"
        actions={
          <Button
            onClick={() => {
              setFormError('');
              setForm(emptyForm);
            }}
          >
            + Преподаватель
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, email, специализация" />
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
        <EmptyState icon="🧑‍🏫" title={data?.length ? 'Никого не найдено' : 'Преподавателей пока нет'} description="Добавьте преподавателя, чтобы назначать ему курсы и группы." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Преподаватель</th>
                <th>Email</th>
                <th>Специализация</th>
                <th>Курсы</th>
                <th>Группы</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar user={t.user} size={40} />
                      <span>
                        <strong>{fullName(t.user)}</strong>
                        <small>{t.position || 'Преподаватель'}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    {t.user.email}
                    {t.phone && <div className="muted" style={{ fontSize: '0.8rem' }}>{t.phone}</div>}
                  </td>
                  <td>{t.specialization || '—'}</td>
                  <td>
                    <div className="badge-row">
                      {t.courses.length ? t.courses.map((c) => <Badge key={c.id}>{c.title}</Badge>) : <span className="muted">—</span>}
                    </div>
                  </td>
                  <td>
                    <div className="badge-row">
                      {t.groups.length ? (
                        t.groups.map((g) => (
                          <Badge key={g.id} tone={g.status === 'ACTIVE' ? 'success' : 'info'}>
                            {g.code}
                          </Badge>
                        ))
                      ) : (
                        <span className="muted">нет</span>
                      )}
                    </div>
                    <small className="muted">Ближайших занятий: {t.upcomingLessons}</small>
                  </td>
                  <td>
                    <div className="badge-row">
                      <Badge tone={t.user.status === 'ACTIVE' ? 'success' : t.user.status === 'BLOCKED' ? 'danger' : 'default'}>
                        {statusLabel[t.user.status] ?? t.user.status}
                      </Badge>
                      {t.isPublic && t.user.status === 'ACTIVE' && <Badge tone="brand">На сайте</Badge>}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <Button size="sm" variant="secondary" onClick={() => openEdit(t)}>
                        Изменить
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setFormError('');
                          setAssignGroupId('');
                          setGroupsFor(t);
                        }}
                      >
                        Группы
                      </Button>
                      {t.user.status === 'ACTIVE' ? (
                        <Button size="sm" variant="ghost" onClick={() => setUserStatus(t, 'BLOCKED')}>
                          Заблокировать
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setUserStatus(t, 'ACTIVE')}>
                          Активировать
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'delete', teacher: t })}>
                        Удалить
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(form)} size="lg" title={form?.userId ? 'Редактирование преподавателя' : 'Новый преподаватель'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
            {form.userId && (
              <div className="profile-head">
                <Avatar user={{ ...form, photoUrl: form.photoUrl }} size={72} />
                <div className="row" style={{ gap: '0.5rem' }}>
                  <Button size="sm" variant="secondary" onClick={() => photoRef.current?.click()} disabled={saving}>
                    {form.photoUrl ? 'Изменить фото' : 'Загрузить фото'}
                  </Button>
                  {form.photoUrl && (
                    <Button size="sm" variant="ghost" onClick={removePhoto} disabled={saving}>
                      Удалить фото
                    </Button>
                  )}
                  <input ref={photoRef} type="file" hidden accept={PHOTO_TYPES.join(',')} onChange={(e) => uploadPhoto(e.target.files?.[0])} />
                </div>
              </div>
            )}
            <div className="form-grid">
              <Field label="Имя">
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Фамилия">
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Email (логин)">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label={form.userId ? 'Новый пароль' : 'Пароль'} hint={form.userId ? 'Оставьте пустым, чтобы не менять' : 'Минимум 6 символов'}>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form.userId} minLength={6} />
              </Field>
              <Field label="Телефон">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+992 90 000 00 00" />
              </Field>
              <Field label="Должность">
                <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Старший преподаватель" maxLength={120} />
              </Field>
              <Field label="Специализация">
                <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Web-разработка" maxLength={120} />
              </Field>
            </div>
            <Field label="Описание (видно на сайте)">
              <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={2000} />
            </Field>
            <Field label="Курсы преподавателя" hint="Курсы групп преподавателя добавляются автоматически">
              {!courses?.length ? (
                <span className="muted">Курсов пока нет</span>
              ) : (
                <div className="check-grid">
                  {courses
                    .filter((c) => c.status !== 'ARCHIVED' || form.courseIds.includes(c.id))
                    .map((c) => (
                      <label key={c.id}>
                        <input
                          type="checkbox"
                          checked={form.courseIds.includes(c.id)}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              courseIds: e.target.checked ? [...form.courseIds, c.id] : form.courseIds.filter((id) => id !== c.id),
                            })
                          }
                        />
                        {c.title}
                      </label>
                    ))}
                </div>
              )}
            </Field>
            <label className="check-line">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} />
              Показывать профиль на сайте Somon (раздел «Преподаватели»)
            </label>
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

      <Modal open={Boolean(groupsFor)} title={groupsFor ? `Группы: ${fullName(groupsFor.user)}` : ''} onClose={() => !saving && setGroupsFor(null)}>
        {groupsFor && (
          <div className="stack">
            {formError && <Alert tone="error">{formError}</Alert>}
            {!groupsFor.groups.length ? (
              <p className="muted" style={{ margin: 0 }}>
                Группы не назначены.
              </p>
            ) : (
              <ul className="list-plain">
                {groupsFor.groups.map((g) => (
                  <li key={g.id} className="list-row">
                    <span style={{ flex: 1 }}>
                      <strong>{g.code}</strong>
                      <span className="muted"> · {g.course.title} · {g._count.groupStudents} студ.</span>
                    </span>
                    <Badge tone={g.status === 'ACTIVE' ? 'success' : 'info'}>{statusLabel[g.status] ?? g.status}</Badge>
                    <Button size="sm" variant="ghost" disabled={saving} onClick={() => setGroupTeacher(g.id, null)}>
                      Снять
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Field label="Назначить группу" hint="Если у группы уже есть преподаватель, он будет заменён">
              <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
                <Select value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}>
                  <option value="">Выберите группу</option>
                  {assignable.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} — {g.course.title}
                      {g.teacher ? ` (сейчас: ${fullName(g.teacher.user)})` : ' (без преподавателя)'}
                    </option>
                  ))}
                </Select>
                <Button disabled={!assignGroupId || saving} onClick={() => setGroupTeacher(assignGroupId, groupsFor.id)}>
                  Назначить
                </Button>
              </div>
            </Field>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Преподаватель получит уведомление о назначении. Управлять составом группы можно в разделе{' '}
              <Link href="/admin/groups" className="text-link">
                «Группы»
              </Link>
              .
            </p>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.kind === 'archive' ? 'Архивировать преподавателя?' : 'Удалить преподавателя?'}
        confirmLabel={confirm?.kind === 'archive' ? 'В архив' : 'Удалить'}
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        message={
          confirm?.kind === 'archive' ? (
            <p style={{ margin: 0 }}>
              У {confirm && fullName(confirm.teacher.user)} есть учебная история, поэтому удалить аккаунт нельзя. В архиве он не сможет войти и не
              будет показан на сайте, но оценки и занятия сохранятся.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Удалить аккаунт {confirm && fullName(confirm.teacher.user)}? Если у преподавателя есть группы, занятия или оценки, будет предложено
              архивирование.
            </p>
          )
        }
      />
    </div>
  );
}
