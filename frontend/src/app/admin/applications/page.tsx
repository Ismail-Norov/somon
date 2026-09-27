'use client';

import { FormEvent, useMemo, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { emitNotificationsChanged } from '@/lib/events';
import type { PersonRef } from '@/lib/types';
import { formatDate, formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type Application = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  message?: string | null;
  createdAt: string;
  updatedAt: string;
  groupId?: string | null;
  group?: { id: string; code: string } | null;
  course: { id: string; title: string; status: string };
  student: { id: string; phone?: string | null; user: PersonRef & { email?: string } };
};

type GroupOption = {
  id: string;
  code: string;
  status: string;
  capacity: number;
  startDate?: string | null;
  courseId: string;
  teacher?: { user: PersonRef } | null;
  _count: { groupStudents: number };
};

type Decision = { app: Application; status: 'APPROVED' | 'REJECTED'; groupId: string; comment: string };

const TABS = [
  { key: 'PENDING', label: 'Новые' },
  { key: 'APPROVED', label: 'Одобренные' },
  { key: 'REJECTED', label: 'Отклонённые' },
  { key: '', label: 'Все' },
] as const;

const TONE: Record<Application['status'], 'warning' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export default function AdminApplicationsPage() {
  const { data, loading, error, reload } = useApiData<Application[]>('/api/student/applications');
  const { data: groups, reload: reloadGroups } = useApiData<GroupOption[]>('/api/groups');
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('PENDING');
  const [decision, setDecision] = useState<Decision | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, '': data?.length ?? 0 };
    for (const a of data ?? []) c[a.status] += 1;
    return c;
  }, [data]);

  const rows = (data ?? []).filter((a) => !tab || a.status === tab);

  const courseGroups = (courseId: string) =>
    (groups ?? []).filter((g) => g.courseId === courseId && g.status !== 'COMPLETED' && g.status !== 'ARCHIVED');

  const open = (app: Application, status: Decision['status']) => {
    setFormError('');
    const options = courseGroups(app.course.id);
    const preferred = app.groupId && options.some((g) => g.id === app.groupId) ? app.groupId : options.find((g) => g._count.groupStudents < g.capacity)?.id;
    setDecision({ app, status, groupId: preferred ?? '', comment: '' });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    setSaving(true);
    setFormError('');
    try {
      await api(`/api/student/applications/${decision.app.id}`, {
        method: 'PATCH',
        json: {
          status: decision.status,
          groupId: decision.status === 'APPROVED' ? decision.groupId || null : undefined,
          comment: decision.comment.trim() || undefined,
        },
      });
      setMsg({
        tone: 'success',
        text:
          decision.status === 'APPROVED'
            ? `${fullName(decision.app.student.user)} зачислен(а) в группу. Студент получил уведомление.`
            : 'Заявка отклонена, студент получил уведомление.',
      });
      setDecision(null);
      reload();
      reloadGroups();
      emitNotificationsChanged();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Не удалось обработать заявку');
    } finally {
      setSaving(false);
    }
  };

  const options = decision ? courseGroups(decision.app.course.id) : [];

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Заявки на курсы" subtitle="Студенты подают заявки из раздела «Доступные курсы». Одобрение зачисляет студента в выбранную группу" />

      {msg && (
        <Alert tone={msg.tone} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key || 'all'} type="button" role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📨" title={tab === 'PENDING' ? 'Новых заявок нет' : 'Заявок нет'} description="Как только студент подаст заявку, она появится здесь и в уведомлениях." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Курс</th>
                <th>Группа</th>
                <th>Комментарий</th>
                <th>Дата</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar user={a.student.user} size={36} />
                      <span>
                        <strong>{fullName(a.student.user)}</strong>
                        <small>{a.student.user.email}</small>
                        {a.student.phone && <small>{a.student.phone}</small>}
                      </span>
                    </div>
                  </td>
                  <td>{a.course.title}</td>
                  <td>{a.group?.code ?? <span className="muted">не выбрана</span>}</td>
                  <td style={{ maxWidth: 260 }}>
                    {a.message ? <span className="pre-wrap" style={{ fontSize: '0.88rem' }}>{a.message}</span> : <span className="muted">—</span>}
                  </td>
                  <td title={formatDateTime(a.createdAt)}>{formatDate(a.createdAt)}</td>
                  <td>
                    <Badge tone={TONE[a.status]}>{statusLabel[a.status]}</Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      {a.status !== 'APPROVED' && (
                        <Button size="sm" onClick={() => open(a, 'APPROVED')}>
                          Одобрить
                        </Button>
                      )}
                      {a.status === 'PENDING' && (
                        <Button size="sm" variant="ghost" onClick={() => open(a, 'REJECTED')}>
                          Отклонить
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

      <Modal
        open={Boolean(decision)}
        title={decision?.status === 'APPROVED' ? 'Одобрить заявку' : 'Отклонить заявку'}
        onClose={() => !saving && setDecision(null)}
      >
        {decision && (
          <form className="stack" onSubmit={submit}>
            {formError && <Alert tone="error">{formError}</Alert>}
            <p style={{ margin: 0 }}>
              <strong>{fullName(decision.app.student.user)}</strong> — курс «{decision.app.course.title}»
            </p>
            {decision.status === 'APPROVED' &&
              (options.length ? (
                <Field label="Группа для зачисления">
                  <Select value={decision.groupId} onChange={(e) => setDecision({ ...decision, groupId: e.target.value })} required>
                    <option value="">Выберите группу</option>
                    {options.map((g) => {
                      const full = g._count.groupStudents >= g.capacity;
                      return (
                        <option key={g.id} value={g.id} disabled={full}>
                          {g.code} · {statusLabel[g.status]} · {g._count.groupStudents}/{g.capacity}
                          {g.teacher ? ` · ${fullName(g.teacher.user)}` : ''}
                          {g.startDate ? ` · старт ${formatDate(g.startDate)}` : ''}
                          {full ? ' (мест нет)' : ''}
                        </option>
                      );
                    })}
                  </Select>
                </Field>
              ) : (
                <Alert tone="warning">
                  У курса нет открытых групп. Создайте группу в разделе «Группы», затем вернитесь к заявке.
                </Alert>
              ))}
            <Field label={decision.status === 'APPROVED' ? 'Сообщение студенту (необязательно)' : 'Причина отказа (необязательно)'}>
              <Textarea rows={3} maxLength={500} value={decision.comment} onChange={(e) => setDecision({ ...decision, comment: e.target.value })} />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setDecision(null)} disabled={saving}>
                Отмена
              </Button>
              <Button
                type="submit"
                variant={decision.status === 'APPROVED' ? 'primary' : 'danger'}
                disabled={saving || (decision.status === 'APPROVED' && !decision.groupId)}
              >
                {saving ? 'Сохраняем...' : decision.status === 'APPROVED' ? 'Зачислить' : 'Отклонить'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
