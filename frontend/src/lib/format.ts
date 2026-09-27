export function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateLong(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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

export function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatTimeRange(start?: string | Date | null, end?: string | Date | null) {
  return `${formatTime(start)}–${formatTime(end)}`;
}

export function fullName(u?: { firstName?: string; lastName?: string } | null) {
  if (!u) return '—';
  return `${u.firstName || ''} ${u.lastName || ''}`.trim() || '—';
}

export function initials(u?: { firstName?: string; lastName?: string } | null) {
  if (!u) return '?';
  return `${u.firstName?.[0] || ''}${u.lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function formatBytes(bytes?: number | null) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return null;
  return `${value.toLocaleString('ru-RU')} сомони`;
}

export function plural(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

export function weeksLabel(n?: number | null) {
  if (!n) return null;
  return `${n} ${plural(n, ['неделя', 'недели', 'недель'])}`;
}

export function lessonsLabel(n?: number | null) {
  if (!n) return null;
  return `${n} ${plural(n, ['занятие', 'занятия', 'занятий'])}`;
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
  EXCUSED: 'Уважительная причина',
  SUBMITTED: 'На проверке',
  REVIEWING: 'На проверке',
  GRADED: 'Проверено',
  OVERDUE: 'Просрочено',
  IN_PROGRESS: 'В работе',
  RETURNED: 'Возвращено на доработку',
  BEGINNER: 'Начальный',
  INTERMEDIATE: 'Средний',
  ADVANCED: 'Продвинутый',
  OFFLINE: 'Офлайн',
  ONLINE: 'Онлайн',
  HYBRID: 'Смешанный',
  STUDENT: 'Студент',
  TEACHER: 'Преподаватель',
  ADMIN: 'Администратор',
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
};

export const materialTypeLabel: Record<string, string> = {
  PDF: 'PDF',
  DOCX: 'Документ',
  PPTX: 'Презентация',
  XLSX: 'Таблица',
  IMAGE: 'Изображение',
  LINK: 'Ссылка',
  NOTE: 'Статья',
  VIDEO: 'Видео',
};

export const materialTypeIcon: Record<string, string> = {
  PDF: '📄',
  DOCX: '📝',
  PPTX: '📊',
  XLSX: '📈',
  IMAGE: '🖼️',
  LINK: '🔗',
  NOTE: '📘',
  VIDEO: '🎥',
};
