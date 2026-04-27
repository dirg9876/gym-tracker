import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BarChart2, Eye, Calendar, TrendingUp } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AnalyticsStats {
  total: number;
  today: number;
  byPage: { page: string; total: number }[];
  last7Days: { date: string; total: number }[];
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Главная",
  "/history": "История",
  "/stats": "Статистика",
  "/levels": "Уровни",
  "/exercises": "Упражнения",
  "/profile": "Профиль",
  "/programs": "Программы",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/analytics/stats`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("Ошибка загрузки");
        return r.json() as Promise<AnalyticsStats>;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">Загрузка...</div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="p-8 text-center text-destructive">{error ?? "Нет данных"}</div>
      </AppShell>
    );
  }

  const maxDay = Math.max(...data.last7Days.map((d) => d.total), 1);
  const maxPage = Math.max(...data.byPage.map((p) => p.total), 1);

  return (
    <AppShell>
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <h1 className="text-2xl font-bold">Аналитика посещений</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <Eye className="h-3.5 w-3.5" />
              Всего просмотров
            </div>
            <div className="text-3xl font-bold text-foreground">{data.total.toLocaleString("ru-RU")}</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <Calendar className="h-3.5 w-3.5" />
              Сегодня
            </div>
            <div className="text-3xl font-bold text-primary">{data.today.toLocaleString("ru-RU")}</div>
          </div>
        </div>

        {/* Last 7 days bar chart */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4 text-primary" />
            Последние 7 дней
          </div>
          {data.last7Days.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет данных за этот период</div>
          ) : (
            <div className="space-y-2">
              {data.last7Days.map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-muted-foreground shrink-0 text-right">
                    {formatDate(d.date)}
                  </div>
                  <div className="flex-1 bg-muted/30 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${(d.total / maxDay) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-right font-medium tabular-nums">{d.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By page */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart2 className="h-4 w-4 text-primary" />
            По страницам
          </div>
          {data.byPage.length === 0 ? (
            <div className="text-sm text-muted-foreground">Нет данных</div>
          ) : (
            <div className="space-y-2">
              {data.byPage.map((p) => (
                <div key={p.page} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground shrink-0 truncate">
                    {PAGE_LABELS[p.page] ?? p.page}
                  </div>
                  <div className="flex-1 bg-muted/30 rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-primary/50 rounded-full transition-all"
                      style={{ width: `${(p.total / maxPage) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-right font-medium tabular-nums">{p.total}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Данные собираются без куков и личных данных. Считаются только загрузки страниц.
        </p>
      </div>
    </AppShell>
  );
}
