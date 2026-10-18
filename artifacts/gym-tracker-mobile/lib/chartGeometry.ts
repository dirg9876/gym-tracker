export function lineChartGeometry(points: { date: string; value: number }[], width: number, height: number) {
  if (!points.length || !Number.isFinite(width) || width <= 80 || !Number.isFinite(height) || height < 40
    || points.some(point => !Number.isFinite(point.value) || !Number.isFinite(Date.parse(point.date)))) return null;
  const left = 56, right = width - 12, top = 14, bottom = height - 14;
  const min = Math.min(0, ...points.map(point => point.value));
  const max = Math.max(0, ...points.map(point => point.value));
  const span = max - min || 1;
  const times = points.map(point => Date.parse(point.date));
  const first = Math.min(...times), last = Math.max(...times);
  const y = (value: number) => bottom - (value - min) / span * (bottom - top);
  const coordinates = points.map((point, index) => ({
    x: points.length === 1 ? (left + right) / 2 : left + (last > first ? (times[index] - first) / (last - first) : index / (points.length - 1)) * (right - left),
    y: y(point.value),
  }));
  return { coordinates, left, right, bottom, ticks: [min, min + span / 2, min + span].map(value => ({ value, y: y(value) })) };
}
