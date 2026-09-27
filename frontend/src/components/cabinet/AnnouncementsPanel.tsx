'use client';

import { useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDateTime, fullName } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Alert, EmptyState, ErrorState, LoadingState } from '@/components/ui/States';

type Announcement = { id: string; title: string; body: string; createdAt: string; author: PersonRef; group: { id: string; code: string } };

/** Create/list/delete group announcements; students are notified on create. */
export function AnnouncementsPanel({ groups, fixedGroupId }: { groups: { id: string; code: string }[]; fixedGroupId?: string }) {
  const [filter, setFilter] = useState(fixedGroupId ?? '');
  const { data, loading, error, reload } = useApiData<Announcement[]>(`/api/student/announcements${filter ? `?groupId=${filter}` : ''}`);
  const [form, setForm] = useState({ groupId: fixedGroupId ?? groups[0]?.id ?? '', title: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/student/announcements', { method: 'POST', json: form });
      setForm({ ...form, title: '', body: '' });
      setMsg({ tone: 'success', text: 'Объявление опубликовано, студенты группы получили уведомление.' });
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось опубликовать' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/student/announcements/${id}`, { method: 'DELETE' });
      setConfirmId(null);
      reload();
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof ApiRequestError ? err.message : 'Не удалось удалить' });
    }
  };

  return (
    <div className="layout-2-1">
      <div className="stack">
        {!fixedGroupId && groups.length > 1 && (
          <div style={{ maxWidth: 280 }}>
            <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Группа">
              <option value="">Все группы</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code}
                </option>
              ))}
            </Select>
          </div>
        )}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !data?.length ? (
          <EmptyState icon="📢" title="Объявлений пока нет" />
        ) : (
          data.map((a) => (
            <article key={a.id} className="card">
              <div className="row space-between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <strong>{a.title}</strong>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {fullName(a.author)} · {formatDateTime(a.createdAt)}
                  </div>
                </div>
                <Badge tone="brand">{a.group.code}</Badge>
              </div>
              <p className="pre-wrap" style={{ margin: '0.5rem 0' }}>{a.body}</p>
              {confirmId === a.id ? (
                <div className="row">
                  <span className="muted">Удалить объявление?</span>
                  <Button size="sm" variant="danger" onClick={() => remove(a.id)}>
                    Удалить
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setConfirmId(null)}>
                    Отмена
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirmId(a.id)}>
                  Удалить
                </Button>
              )}
            </article>
          ))
        )}
      </div>
      <form className="card" onSubmit={submit}>
        <h2 className="card-title">Новое объявление</h2>
        {msg && (
          <Alert tone={msg.tone} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}
        {!fixedGroupId && (
          <Field label="Группа">
            <Select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} required>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.code}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Заголовок">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
        </Field>
        <Field label="Текст">
          <Textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required maxLength={5000} />
        </Field>
        <Button type="submit" disabled={saving || !form.groupId}>
          {saving ? 'Публикуем...' : 'Опубликовать'}
        </Button>
      </form>
    </div>
  );
}
