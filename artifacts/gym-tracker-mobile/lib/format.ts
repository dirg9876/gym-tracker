export function formatKg(weight: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(weight))} кг`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(num));
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatShortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(new Date(dateStr));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h > 0) {
    return `${h} ч ${m} мин`;
  }
  return `${m} мин`;
}

export function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}
