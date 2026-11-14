export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function nextFullHour(hoursAhead = 1): Date {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursAhead);
  return date;
}

export function relativeTime(target: Date, now = new Date()): string {
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

export function timeAgo(date: Date, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDuration(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 7 ? '1 week' : `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}
