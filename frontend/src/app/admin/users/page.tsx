'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiData } from '@/lib/useApiData';
import { formatDate, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  status: string;
  createdAt: string;
  phone?: string | null;
};

type UserForm = { id?: string; firstName: string; lastName: string; email: string; phone: string; password: string; role: string; status: string };

const emptyForm: UserForm = { firstName: '', lastName: '', email: '', phone: '', password: 'Somon123!', role: 'STUDENT', status: 'ACTIVE' };
const ROLE_TONE: Record<string, 'brand' | 'info' | 'warning'> = { STUDENT: 'brand', TEACHER: 'info', ADMIN: 'warning' };

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debounced) params.set('q', debounced);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const qs = params.toString();
  const { data, loading, error, reload } = useApiData<UserRow[]>(`/api/users${qs ? `?${qs}` : ''}`);

  const [form, setForm] = useState<UserForm | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'archive'; user: UserRow } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError('');
    const { id, password, ...rest } = form;
    const json = {
      ...rest,
      firstName: rest.firstName.trim(),
      lastName: rest.lastName.trim(),
      email: rest.email.trim(),
      phone: rest.phone.trim(),
      ...(password ? { password } : {}),
    };
    try {
      if (id) {
        await api(`/api/users/${id}`, { method: 'PATCH', json });
        setMsg({ tone: 'success', text: password ? 'Данные и пароль обновлены.' : 'Данные пользователя обновлены.' });
      } else {
        await api('/api/users', {
          method: 'POST',
          json: { firstName: json.firstName, lastName: json.lastName, email: json.email, phone: json.phone, role: json.role, password },
        });
        setMsg({ tone: 'success', text: `Пользователь создан. Логин: ${json.email}` });
      }
      setForm(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const setUserStatus = async (u: UserRow, next: 'ACTIVE' | 'BLOCKED') => {
    try {
      await api(`/api/users/${u.id}`, { method: 'PATCH', json: { status: next } });
      setMsg({ tone: 'success', text: next === 'ACTIVE' ? `${fullName(u)} активирован(а).` : `${fullName(u)} заблокирован(а) и не сможет войти.` });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setSaving(true);
    try {
      if (kind === 'delete') {
        await api(`/api/users/${user.id}`, { method: 'DELETE' });
        setMsg({ tone: 'success', text: 'Пользователь удалён.' });
      } else {
        await api(`/api/users/${user.id}/archive`, { method: 'PATCH' });
        setMsg({ tone: 'success', text: 'Пользователь перемещён в архив.' });
      }
      setConfirm(null);
      reload();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'USER_HAS_DATA') {
        setConfirm({ kind: 'archive', user });
        setMsg({ tone: 'warning', text: err.message });
      } else {
        setConfirm(null);
        setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось выполнить действие' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        title="Пользователи"
        subtitle="Все учётные записи: студенты, преподаватели и администраторы"
        actions={
          <Button
            onClick={() => {
              setFormError('');
              setForm(emptyForm);
            }}
          >
            + Пользователь
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя или email" />
        </Field>
        <Field label="Роль">
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Все роли</option>
            <option value="STUDENT">Студенты</option>
            <option value="TEACHER">Преподаватели</option>
            <option value="ADMIN">Администраторы</option>
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

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState icon="👤" title={qs ? 'Никого не найдено' : 'Пользователей пока нет'} />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Телефон</th>
                <th>Статус</th>
                <th>Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => {
                const self = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="person-cell">
                        <Avatar user={u} size={36} />
                        <span>
                          <strong>
                            {fullName(u)}
                            {self && <span className="muted"> (вы)</span>}
                          </strong>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge tone={ROLE_TONE[u.role]}>{statusLabel[u.role]}</Badge>
                    </td>
                    <td>{u.phone || '—'}</td>
                    <td>
                      <Badge tone={u.status === 'ACTIVE' ? 'success' : u.status === 'BLOCKED' ? 'danger' : 'default'}>{statusLabel[u.status] ?? u.status}</Badge>
                    </td>
                    <td>{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        {u.role === 'STUDENT' && (
                          <ButtonLink size="sm" variant="ghost" href={`/admin/students/${u.id}`}>
                            Карточка
                          </ButtonLink>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setFormError('');
                            setForm({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? '', password: '', role: u.role, status: u.status });
                          }}
                        >
                          Изменить
                        </Button>
                        {!self &&
                          (u.status === 'ACTIVE' ? (
                            <Button size="sm" variant="ghost" onClick={() => setUserStatus(u, 'BLOCKED')}>
                              Заблокировать
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setUserStatus(u, 'ACTIVE')}>
                              Активировать
                            </Button>
                          ))}
                        {!self && (
                          <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'delete', user: u })}>
                            Удалить
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={Boolean(form)} title={form?.id ? 'Редактирование пользователя' : 'Новый пользователь'} onClose={() => !saving && setForm(null)}>
        {form && (
          <form className="stack" onSubmit={save}>
            {formError && <Alert tone="error">{formError}</Alert>}
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
              <Field label="Телефон">
                <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={form.role === 'ADMIN'} />
              </Field>
              <Field label="Роль" hint={form.id ? 'Смена роли меняет доступный кабинет' : undefined}>
                <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} disabled={form.id === me?.id}>
                  <option value="STUDENT">Студент</option>
                  <option value="TEACHER">Преподаватель</option>
                  <option value="ADMIN">Администратор</option>
                </Select>
              </Field>
              {form.id && (
                <Field label="Статус">
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={form.id === me?.id}>
                    <option value="ACTIVE">Активен</option>
                    <option value="BLOCKED">Заблокирован</option>
                    <option value="ARCHIVED">Архив</option>
                  </Select>
                </Field>
              )}
              <Field label={form.id ? 'Новый пароль' : 'Пароль'} hint={form.id ? 'Оставьте пустым, чтобы не менять' : 'Минимум 6 символов'}>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!form.id} minLength={6} />
              </Field>
            </div>
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

      <ConfirmModal
        open={Boolean(confirm)}
        title={confirm?.kind === 'archive' ? 'Архивировать пользователя?' : 'Удалить пользователя?'}
        confirmLabel={confirm?.kind === 'archive' ? 'В архив' : 'Удалить'}
        busy={saving}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        message={
          confirm?.kind === 'archive' ? (
            <p style={{ margin: 0 }}>
              У пользователя {confirm && fullName(confirm.user)} есть учебные данные. В архиве он не сможет войти, но история сохранится.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Удалить {confirm && fullName(confirm.user)} без возможности восстановления? Если есть учебные данные, будет предложено архивирование.
            </p>
          )
        }
      />
    </div>
  );
}
