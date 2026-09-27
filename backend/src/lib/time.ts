/** Timezone used in notification texts; defaults to the server's local zone. */
const timeZone = process.env.APP_TIMEZONE || undefined;

export function formatTime(d: Date) {
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone });
}

export function formatDateTime(d: Date) {
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone });
}

function dayKey(d: Date) {
  return d.toLocaleDateString('ru-RU', { timeZone });
}

/** "Сегодня" / "Завтра" / "12 октября" relative to now in the app timezone. */
export function relativeDay(d: Date, now = new Date()) {
  if (dayKey(d) === dayKey(now)) return 'Сегодня';
  if (dayKey(d) === dayKey(new Date(now.getTime() + 86400000))) return 'Завтра';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone });
}
