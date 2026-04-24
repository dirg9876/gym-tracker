export function formatKg(weight: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(weight)} кг`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('ru-RU').format(num);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
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
