export function lineChartGeometry(points: { date: string; value: number }[], width: number, height: number, zeroBaseline = true) {
  if (!points.length || !Number.isFinite(width) || width <= 80 || !Number.isFinite(height) || height < 40
    || points.some(point => !Number.isFinite(point.value) || !Number.isFinite(Date.parse(point.date)))) return null;
  const left = 56, right = width - 12, top = 14, bottom = height - 14;
  const values = points.map(point => point.value), low = Math.min(...values), high = Math.max(...values);
  const padding = Math.max((high - low) * 0.15, 0.1);
  const min = zeroBaseline ? Math.min(0, low) : low >= 0 ? Math.max(0, low - padding) : low - padding;
  const max = zeroBaseline ? Math.max(0, high) : high + padding;
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
