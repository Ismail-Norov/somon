export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fullName(u?: { firstName?: string; lastName?: string } | null) {
  if (!u) return '—';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
}

export const statusLabel: Record<string, string> = {
  ACTIVE: 'Активен',
  BLOCKED: 'Заблокирован',
  ARCHIVED: 'Архив',
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  PLANNED: 'Планирование',
  ENROLLMENT: 'Набор',
  COMPLETED: 'Завершён',
  SCHEDULED: 'Запланировано',
  CANCELLED: 'Отменено',
  PRESENT: 'Присутствовал',
  ABSENT: 'Отсутствовал',
  LATE: 'Опоздал',
  EXCUSED: 'Уважительно',
  SUBMITTED: 'Отправлено',
  REVIEWING: 'На проверке',
  GRADED: 'Проверено',
  OVERDUE: 'Просрочено',
  IN_PROGRESS: 'В работе',
  RETURNED: 'Возвращено',
  BEGINNER: 'Начальный',
  INTERMEDIATE: 'Средний',
  ADVANCED: 'Продвинутый',
  OFFLINE: 'Очно',
  ONLINE: 'Онлайн',
  HYBRID: 'Смешанный',
  STUDENT: 'Студент',
  TEACHER: 'Преподаватель',
  ADMIN: 'Администратор',
};
