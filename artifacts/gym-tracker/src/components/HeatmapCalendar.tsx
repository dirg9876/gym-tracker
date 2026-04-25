import { useMemo, useState } from "react";
import { useGetHeatmap, type HeatmapDay } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { formatKg } from "@/lib/format";

const CELL = 12;
const GAP = 3;
const COLORS = [
  "hsl(0 0% 20%)",
  "hsl(13 90% 30%)",
  "hsl(13 90% 45%)",
  "hsl(13 95% 55%)",
  "hsl(13 100% 65%)",
];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

const MONTH_NAMES = [
  "Янв",
  "Фев",
  "Мар",
  "Апр",
  "Май",
  "Июн",
  "Июл",
  "Авг",
  "Сен",
  "Окт",
  "Ноя",
  "Дек",
];

export function HeatmapCalendar() {
  const { data, isLoading } = useGetHeatmap({ days: 365 });
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);

  const grid = useMemo(() => {
    if (!data) return null;
    // Pad start so first column begins on Monday
    const days = data.days;
    if (days.length === 0) return null;
    const first = parseLocalDate(days[0]!.date);
    const dow = (first.getDay() + 6) % 7; // 0=Mon..6=Sun
    const padded: (HeatmapDay | null)[] = [];
    for (let i = 0; i < dow; i++) padded.push(null);
    for (const d of days) padded.push(d);
    // Pad end to fill the week
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) cols.push(padded.slice(i, i + 7));
    return cols;
  }, [data]);

  if (isLoading || !data || !grid) return null;

  const width = grid.length * (CELL + GAP) + 24;
  const height = 7 * (CELL + GAP) + 28;

  // Determine month label positions
  const monthLabels: Array<{ x: number; label: string }> = [];
  let lastMonth = -1;
  grid.forEach((col, ci) => {
    const firstDay = col.find((c) => c !== null);
    if (!firstDay) return;
    const m = parseLocalDate(firstDay.date).getMonth();
    if (m !== lastMonth) {
      lastMonth = m;
      monthLabels.push({ x: 24 + ci * (CELL + GAP), label: MONTH_NAMES[m]! });
    }
  });

  return (
    <section className="bg-card p-4 rounded-3xl border border-border space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Активность за год
        </h2>
        <span className="text-xs text-muted-foreground">
          {data.activeDays} / {data.totalDays} дн.
        </span>
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <svg width={width} height={height} className="block">
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={10}
              fontSize={9}
              fill="hsl(var(--muted-foreground))"
            >
              {m.label}
            </text>
          ))}
          {["Пн", "", "Ср", "", "Пт", "", "Вс"].map((d, i) => (
            <text
              key={i}
              x={0}
              y={28 + i * (CELL + GAP) + 9}
              fontSize={8}
              fill="hsl(var(--muted-foreground))"
            >
              {d}
            </text>
          ))}
          {grid.map((col, ci) =>
            col.map((cell, ri) => {
              if (!cell) return null;
              const x = 24 + ci * (CELL + GAP);
              const y = 16 + ri * (CELL + GAP);
              return (
                <motion.rect
                  key={`${ci}-${ri}`}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={COLORS[cell.intensity] ?? COLORS[0]}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(0.3, ci * 0.005) }}
                  onMouseEnter={() => setHovered(cell)}
                  onMouseLeave={() => setHovered((h) => (h === cell ? null : h))}
                  onTouchStart={() => setHovered(cell)}
                  style={{ cursor: "pointer" }}
                />
              );
            }),
          )}
        </svg>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span>Меньше</span>
          {COLORS.map((c, i) => (
            <span
              key={i}
              className="inline-block rounded-sm"
              style={{ backgroundColor: c, width: 10, height: 10 }}
            />
          ))}
          <span>Больше</span>
        </div>
        <div className="text-muted-foreground tabular-nums min-h-4">
          {hovered
            ? `${new Date(hovered.date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "short",
              })}: ${formatKg(hovered.volume)} · ${hovered.sets} подх.`
            : ""}
        </div>
      </div>
    </section>
  );
}
