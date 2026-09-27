export type CalendarView = 'month' | 'week' | 'day';

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** Visible hours in week/day views. */
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 22;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-based week start. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

/** [from, to) range loaded for the current view. Month view shows full weeks around the month. */
export function viewRange(view: CalendarView, cursor: Date) {
  if (view === 'day') {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const from = startOfWeek(first);
  return { from, to: addDays(from, 42) };
}

export function shiftCursor(view: CalendarView, cursor: Date, dir: 1 | -1) {
  if (view === 'day') return addDays(cursor, dir);
  if (view === 'week') return addDays(cursor, 7 * dir);
  return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
}

export function viewTitle(view: CalendarView, cursor: Date) {
  if (view === 'month') return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  if (view === 'day') {
    const s = cursor.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const from = startOfWeek(cursor);
  const to = addDays(from, 6);
  const sameMonth = from.getMonth() === to.getMonth();
  const left = from.toLocaleDateString('ru-RU', sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'long' });
  const right = to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${left} – ${right}`;
}

export function timeLabel(d: Date) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/** Vertical position (in % of the visible day) for the time grid. */
export function timePosition(start: Date, end: Date) {
  const span = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const minutes = (d: Date) => Math.min(span, Math.max(0, (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes()));
  const top = minutes(start);
  const bottom = Math.max(top + 30, minutes(end));
  return { top: (top / span) * 100, height: ((bottom - top) / span) * 100 };
}

/** Assigns side-by-side columns to overlapping events of one day. */
export function layoutColumns<T extends { startsAt: string; endsAt: string }>(items: T[]) {
  const sorted = [...items].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const result: { item: T; col: number; cols: number }[] = [];
  let cluster: { item: T; col: number; cols: number }[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => (c.cols = cols));
    result.push(...cluster);
    cluster = [];
  };
  for (const item of sorted) {
    const s = +new Date(item.startsAt);
    const e = +new Date(item.endsAt);
    if (cluster.length && s >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => +new Date(c.item.endsAt) > s).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  }
  if (cluster.length) flush();
  return result;
}
