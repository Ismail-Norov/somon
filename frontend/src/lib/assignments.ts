import type { Assignment } from './types';

export type AssignmentStateKey = 'active' | 'review' | 'graded';

/** Student-facing state of an assignment, derived from their submission. */
export function studentAssignmentState(a: Assignment) {
  const sub = a.submissions?.[0] ?? a.submission ?? null;
  const overdue = Boolean(a.deadline && new Date(a.deadline) < new Date());
  if (sub?.status === 'GRADED') return { key: 'graded' as const, label: 'Проверено', tone: 'success' as const, sub, overdue };
  if (sub?.status === 'RETURNED') return { key: 'active' as const, label: 'На доработку', tone: 'warning' as const, sub, overdue };
  if (sub?.submittedAt && ['SUBMITTED', 'REVIEWING'].includes(sub.status))
    return { key: 'review' as const, label: 'На проверке', tone: 'info' as const, sub, overdue };
  if (overdue) return { key: 'active' as const, label: 'Просрочено', tone: 'danger' as const, sub, overdue };
  return { key: 'active' as const, label: 'Не сдано', tone: 'default' as const, sub, overdue };
}
