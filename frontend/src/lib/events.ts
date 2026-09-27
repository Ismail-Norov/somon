/** Fired after notifications are read so the header badge refreshes immediately. */
export const NOTIFICATIONS_EVENT = 'somon:notifications';

export function emitNotificationsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_EVENT));
}
