'use client';

import { FormEvent, useState } from 'react';
import { api, ApiRequestError } from '@/lib/api';
import { useApiData } from '@/lib/useApiData';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime, statusLabel } from '@/lib/format';

type Assignment = {
  id: string;
  title: string;
  description?: string;
  deadline?: string;
  maxScore: number;
  course: { title: string };
  group?: { code: string };
  submissions: { id: string; status: string; text?: string; grade?: { score: number; comment?: string } }[];
};

export default function StudentAssignmentsPage() {
  const { data, loading, error, reload } = useApiData<Assignment[]>('/api/assignments');
  const [current, setCurrent] = useState<Assignment | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!current) return;
    setSaving(true);
    setMsg('');
    try {
      await api(`/api/assignments/${current.id}/submissions`, {
        method: 'POST',
        json: { text },
      });
      setCurrent(null);
      setText('');
      reload();
    } catch (err) {
      setMsg(err instanceof ApiRequestError ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      <h1 className="page-title">Задания</h1>
      <p className="page-sub">Отправка ответов и статусы проверки</p>
      {!data?.length && <EmptyState title="Заданий пока нет" />}
      <div className="stack">
        {data?.map((a) => {
          const sub = a.submissions[0];
          const st = sub?.status || 'PUBLISHED';
          return (
            <div className="card row space-between" key={a.id}>
              <div>
                <strong>{a.title}</strong>
                <p style={{ margin: '0.25rem 0' }}>
                  {a.course.title} · {a.group?.code} · до {formatDateTime(a.deadline)}
                </p>
                {sub?.grade && (
                  <Badge tone="success">
                    {sub.grade.score}/{a.maxScore}
                  </Badge>
                )}
              </div>
              <div className="row">
                <Badge
                  tone={
                    st === 'GRADED' ? 'success' : st === 'OVERDUE' ? 'danger' : st === 'SUBMITTED' ? 'info' : 'warning'
                  }
                >
                  {statusLabel[st] || st}
                </Badge>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrent(a);
                    setText(sub?.text || '');
                  }}
                >
                  {sub ? 'Обновить ответ' : 'Сдать'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!current} title={current?.title || ''} onClose={() => setCurrent(null)}>
        <p>{current?.description}</p>
        <form onSubmit={submit}>
          <Field label="Ответ">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} required />
          </Field>
          {msg && <p className="error-text">{msg}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Отправка...' : 'Отправить'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
