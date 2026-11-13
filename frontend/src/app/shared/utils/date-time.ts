export function toDateTimeLocal(date: Date): string {      // format de <input type="datetime-local"> : "2026-11-02T09:00"
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextFullHour(hoursAhead = 1): Date {       // ex. il est 14:20 → 15:00 (hoursAhead = 1)
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursAhead);
  return date;
}

export function relativeTime(target: Date, now = new Date()): string { // ex. "in 2 days", "in 5 hours", "in 12 minutes"
  const minutes = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) {
    return `in ${Math.max(1, minutes)} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const days = Math.round(hours / 24);
  return `in ${days} days`;
}

export function formatDuration(hours: number): string {    // ex. 1 → "1 hour", 48 → "2 days", 30 → "30 hours"
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 7 ? '1 week' : `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
