export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function toTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD string, independent of server TZ. */
export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function isValidDate(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().startsWith(date);
}

/** Combines date + time as a local (server timezone) Date. */
export function toDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}
