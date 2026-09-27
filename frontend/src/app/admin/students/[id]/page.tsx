'use client';

import { useParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDate, formatDateLong, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StudentGroupReport, type StudentGroupCard } from '@/components/cabinet/StudentGroupReport';

type StudentProfile = PersonRef & {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  student: {
    id: string;
    phone?: string | null;
    groupStudents: {
      id: string;
      status: string;
      joinedAt: string;
      group: { id: string; code: string; status: string; course: { id: string; title: string }; teacher?: { user: PersonRef } | null };
    }[];
  } | null;
  applications: { id: string; status: string; createdAt: string; course: { id: string; title: string } }[];
};

export default function AdminStudentPage() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error, reload } = useApiData<StudentProfile>(`/api/users/${id}`);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ firstName: string; lastName: string; email: string; phone: string; password: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const links = data?.student?.groupStudents ?? [];
  const activeGroupId = groupId ?? links[0]?.group.id ?? null;
  const activeLink = links.find((l) => l.group.id === activeGroupId);
  const studentId = data?.student?.id;
  const { data: report, loading: reportLoading, error: reportError, reload: reloadReport } = useApiData<StudentGroupCard>(
    activeGroupId && studentId ? `/api/groups/${activeGroupId}/students/${studentId}` : null
  );

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit || !data) return;
    setSaving(true);
    setFormError('');
    try {
      await api(`/api/users/${data.id}`, {
        method: 'PATCH',
        json: {
          firstName: edit.firstName.trim(),
          lastName: edit.lastName.trim(),
          email: edit.email.trim(),
          phone: edit.phone.trim(),
          ...(edit.password ? { password: edit.password } : {}),
        },
      });
      setMsg({ tone: 'success', text: edit.password ? 'Данные и пароль обновлены.' : 'Данные обновлены.' });
      setEdit(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: 'ACTIVE' | 'BLOCKED') => {
    if (!data) return;
    try {
      await api(`/api/users/${data.id}`, { method: 'PATCH', json: { status } });
      setMsg({ tone: 'success', text: status === 'ACTIVE' ? 'Аккаунт активирован.' : 'Аккаунт заблокирован.' });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось изменить статус' });
    }
  };

  const removeFromGroup = async () => {
    if (!activeLink || !studentId) return;
    setSaving(true);
    try {
      await api(`/api/groups/${activeLink.group.id}/students/${studentId}`, { method: 'DELETE' });
      setMsg({ tone: 'success', text: `Студент исключён из группы ${activeLink.group.code}. История обучения сохранена.` });
      setConfirmRemove(false);
      setGroupId(null);
      reload();
    } catch (err) {
      setConfirmRemove(false);
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось исключить' });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingState />;
  if (error || !data) return <ErrorState message={error || 'Студент не найден'} onRetry={reload} />;

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader
        back={{ href: '/admin/students', label: 'Назад к студентам' }}
        title="Карточка студента"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setFormError('');
                setEdit({ firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.student?.phone ?? '', password: '' });
              }}
            >
              Изменить
            </Button>
            {data.status === 'ACTIVE' ? (
              <Button variant="ghost" onClick={() => setStatus('BLOCKED')}>
                Заблокировать
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setStatus('ACTIVE')}>
                Активировать
              </Button>
            )}
          </>
        }
      />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="card row" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <Avatar user={data} size={80} />
        <div className="stack" style={{ gap: '0.25rem', flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0 }}>{fullName(data)}</h2>
          <span className="muted">{data.email}</span>
          {data.student?.phone && <span className="muted">{data.student.phone}</span>}
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Зарегистрирован(а) {formatDateLong(data.createdAt)}
          </span>
        </div>
        <Badge tone={data.status === 'ACTIVE' ? 'success' : data.status === 'BLOCKED' ? 'danger' : 'default'}>{statusLabel[data.status] ?? data.status}</Badge>
      </div>

      {!links.length ? (
        <EmptyState icon="👥" title="Студент не состоит в группах" description="Добавьте его в группу в разделе «Студенты» или одобрите заявку на курс." />
      ) : (
        <>
          <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <div className="tabs" role="tablist" style={{ marginBottom: 0, flex: 1 }}>
              {links.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  aria-selected={l.group.id === activeGroupId}
                  className={`tab ${l.group.id === activeGroupId ? 'active' : ''}`}
                  onClick={() => setGroupId(l.group.id)}
                >
                  {l.group.code} · {l.group.course.title}
                  {l.status !== 'ACTIVE' ? ` (${statusLabel[l.status] ?? l.status})` : ''}
                </button>
              ))}
            </div>
            {activeLink?.status === 'ACTIVE' && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(true)}>
                Исключить из группы
              </Button>
            )}
          </div>
          {activeLink && (
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              Преподаватель: {activeLink.group.teacher ? fullName(activeLink.group.teacher.user) : 'не назначен'} · в группе с {formatDate(activeLink.joinedAt)}
            </p>
          )}
          {reportLoading ? (
            <LoadingState />
          ) : reportError ? (
            <ErrorState message={reportError} onRetry={reloadReport} />
          ) : report ? (
            <StudentGroupReport data={report} />
          ) : null}
        </>
      )}

      {data.applications.length > 0 && (
        <section className="card">
          <h2 className="card-title">Заявки на курсы</h2>
          {data.applications.map((a) => (
            <div key={a.id} className="list-row">
              <span style={{ flex: 1 }}>{a.course.title}</span>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {formatDate(a.createdAt)}
              </span>
              <Badge tone={a.status === 'APPROVED' ? 'success' : a.status === 'REJECTED' ? 'danger' : 'warning'}>{statusLabel[a.status]}</Badge>
            </div>
          ))}
        </section>
      )}

      <Modal open={Boolean(edit)} title="Данные студента" onClose={() => !saving && setEdit(null)}>
        {edit && (
          <form className="stack" onSubmit={saveEdit}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <div className="form-grid">
              <Field label="Имя">
                <Input value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Фамилия">
                <Input value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} required maxLength={60} />
              </Field>
              <Field label="Email (логин)">
                <Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} required />
              </Field>
              <Field label="Телефон">
                <Input type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </Field>
              <Field label="Новый пароль" hint="Оставьте пустым, чтобы не менять">
                <Input value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} minLength={6} />
              </Field>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setEdit(null)} disabled={saving}>
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
        open={confirmRemove}
        title="Исключить из группы?"
        confirmLabel="Исключить"
        busy={saving}
        onClose={() => setConfirmRemove(false)}
        onConfirm={removeFromGroup}
        message={
          <p style={{ margin: 0 }}>
            {fullName(data)} больше не будет видеть занятия, задания и материалы группы {activeLink?.group.code}. Оценки и посещаемость сохранятся.
          </p>
        }
      />
    </div>
  );
}
