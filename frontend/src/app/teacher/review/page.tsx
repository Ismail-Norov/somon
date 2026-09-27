'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import type { PersonRef } from '@/lib/types';
import { formatDateTime, fullName, statusLabel } from '@/lib/format';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { PageHeader } from '@/components/cabinet/PageHeader';

type ReviewItem = {
  id: string;
  status: string;
  submittedAt?: string | null;
  attemptCount: number;
  student: { id: string; user: PersonRef };
  assignment: { id: string; title: string; maxScore: number; deadline?: string | null; group?: { id: string; code: string } | null; course: { title: string } };
  grade?: { score: number; maxScore: number } | null;
};

type StatusTab = 'SUBMITTED' | 'GRADED' | 'all';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'SUBMITTED', label: 'На проверке' },
  { key: 'GRADED', label: 'Проверенные' },
  { key: 'all', label: 'Все работы' },
];

function statusBadge(item: ReviewItem) {
  if (item.status === 'GRADED' && item.grade) return <Badge tone="success">{`${item.grade.score} / ${item.grade.maxScore}`}</Badge>;
  if (item.status === 'REVIEWING') return <Badge tone="brand">Открыта</Badge>;
  if (item.status === 'SUBMITTED') return <Badge tone="info">Новая</Badge>;
  if (item.status === 'RETURNED') return <Badge tone="warning">На доработке</Badge>;
  return <Badge>{statusLabel[item.status] ?? item.status}</Badge>;
}

function ReviewInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<StatusTab>('SUBMITTED');
  const [groupId, setGroupId] = useState(params.get('groupId') ?? '');
  const groups = useApiData<{ id: string; code: string }[]>('/api/groups');
  const { data, loading, error, reload } = useApiData<ReviewItem[]>(
    `/api/assignments/submissions/review?status=${tab}${groupId ? `&groupId=${groupId}` : ''}`
  );

  return (
    <div className="stack" style={{ gap: '1rem' }}>
      <PageHeader title="Работы на проверке" subtitle="Ответы студентов по вашим заданиям" back={{ href: '/teacher/dashboard', label: 'Назад на главную' }} />

      <div className="row space-between" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div className="segmented" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Группа">
            <option value="">Все группы</option>
            {groups.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.code}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          icon={tab === 'SUBMITTED' ? '🎉' : '📭'}
          title={tab === 'SUBMITTED' ? 'Все работы проверены' : 'Работ пока нет'}
          description={tab === 'SUBMITTED' ? 'Новые ответы студентов появятся здесь, и вы получите уведомление.' : undefined}
        />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Студент</th>
                <th>Задание</th>
                <th>Группа</th>
                <th>Отправлено</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((s) => {
                const late = Boolean(s.submittedAt && s.assignment.deadline && new Date(s.submittedAt) > new Date(s.assignment.deadline));
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="row" style={{ gap: '0.6rem' }}>
                        <Avatar user={s.student.user} size={34} />
                        <strong>{fullName(s.student.user)}</strong>
                      </div>
                    </td>
                    <td>
                      <Link href={`/teacher/assignments/${s.assignment.id}`} className="text-link">
                        {s.assignment.title}
                      </Link>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>
                        {s.assignment.course.title}
                      </div>
                    </td>
                    <td>{s.assignment.group?.code ?? '—'}</td>
                    <td>
                      {s.submittedAt ? formatDateTime(s.submittedAt) : '—'}
                      <div className="row" style={{ gap: '0.3rem', marginTop: '0.2rem' }}>
                        {late && <Badge tone="warning">С опозданием</Badge>}
                        {s.attemptCount > 1 && <Badge>{`Попытка ${s.attemptCount}`}</Badge>}
                      </div>
                    </td>
                    <td>{statusBadge(s)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <ButtonLink href={`/teacher/review/${s.id}`} size="sm" variant={s.status === 'GRADED' ? 'secondary' : 'primary'}>
                        {s.status === 'GRADED' ? 'Открыть' : 'Проверить'}
                      </ButtonLink>
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

export default function TeacherReviewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReviewInner />
    </Suspense>
  );
}
