'use client';

import { useMemo, useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import type { Assignment } from '@/lib/types';
import { formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';
import { StatCard } from '@/components/cabinet/StatCard';

type GroupOption = { id: string; code: string; course: { title: string } };

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  PUBLISHED: 'success',
  DRAFT: 'warning',
  OVERDUE: 'danger',
  ARCHIVED: 'default',
};

export default function AdminAssignmentsPage() {
  const [groupId, setGroupId] = useState('');
  const { data, loading, error, reload } = useApiData<Assignment[]>(`/api/assignments${groupId ? `?groupId=${groupId}` : ''}`);
  const { data: groups } = useApiData<GroupOption[]>('/api/groups');
  const [q, setQ] = useState('');
  const [onlyPending, setOnlyPending] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter((a) => {
      if (onlyPending && !a.pendingReview) return false;
      return !needle || [a.title, a.course?.title, a.group?.code].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [data, q, onlyPending]);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      pending: list.reduce((s, a) => s + (a.pendingReview ?? 0), 0),
      submissions: list.reduce((s, a) => s + (a._count?.submissions ?? 0), 0),
      overdue: list.filter((a) => a.deadline && new Date(a.deadline) < new Date() && a.status !== 'ARCHIVED').length,
    };
  }, [data]);

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Задания" subtitle="Все задания групп. Создают и проверяют задания преподаватели групп" />

      <div className="grid grid-4">
        <StatCard icon="📝" label="Всего заданий" value={totals.total} tone="brand" />
        <StatCard icon="📥" label="Работ на проверке" value={totals.pending} tone={totals.pending ? 'warning' : 'success'} />
        <StatCard icon="📨" label="Сдано работ" value={totals.submissions} tone="info" />
        <StatCard icon="⏰" label="Срок прошёл" value={totals.overdue} tone="danger" />
      </div>

      <div className="card form-grid">
        <Field label="Поиск">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Задание, курс, группа" />
        </Field>
        <Field label="Группа">
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Все группы</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.code} — {g.course.title}
              </option>
            ))}
          </Select>
        </Field>
        <label className="check-line" style={{ alignSelf: 'end', paddingBottom: '0.6rem' }}>
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Только с работами на проверке
        </label>
      </div>

      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon="📝" title="Заданий нет" description="Задания появляются, когда преподаватели создают их для своих групп." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Задание</th>
                <th>Группа</th>
                <th>Преподаватель</th>
                <th>Срок</th>
                <th>Сдано</th>
                <th>На проверке</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const overdue = a.deadline && new Date(a.deadline) < new Date();
                return (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {a.course?.title} · макс. {a.maxScore} б.{a.allowResubmit ? ' · пересдача разрешена' : ''}
                      </div>
                    </td>
                    <td>{a.group?.code ?? '—'}</td>
                    <td>{a.group?.teacher ? fullName(a.group.teacher.user) : <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap', color: overdue ? 'var(--danger)' : undefined }}>{a.deadline ? formatDateTime(a.deadline) : 'Без срока'}</td>
                    <td>{a._count?.submissions ?? 0}</td>
                    <td>{a.pendingReview ? <Badge tone="warning">{a.pendingReview}</Badge> : <span className="muted">0</span>}</td>
                    <td>
                      <Badge tone={STATUS_TONE[a.status] ?? 'default'}>{statusLabel[a.status] ?? a.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
