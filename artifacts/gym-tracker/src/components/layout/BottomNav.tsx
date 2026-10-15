import { Link, useLocation } from "wouter";
import { Home, BarChart2, Dumbbell, Trophy, ClipboardList } from "lucide-react";

const LABEL_STYLE: React.CSSProperties = { fontSize: "9px", letterSpacing: "0.02em" };

export function BottomNav() {
  const [location] = useLocation();

  const isHome = location === "/";

  const sideItems = [
    [
      { href: "/programs", icon: ClipboardList, label: "Тренировки" },
      { href: "/exercises", icon: Dumbbell, label: "Упражнения" },
    ],
    [
      { href: "/levels", icon: Trophy, label: "Уровни" },
      { href: "/stats", icon: BarChart2, label: "Статистика" },
    ],
  ] as const;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <nav className="grid grid-cols-5 h-16 items-center">
        {/* Left pair — cols 1-2 */}
        {sideItems[0].map((item) => {
          const isActive =
            location === item.href || location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium leading-none" style={LABEL_STYLE}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Center — Home — col 3 */}
        <Link href="/" className="flex items-center justify-center h-full">
          <div
            className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-2xl transition-all ${
              isHome
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="font-bold leading-none" style={LABEL_STYLE}>Главная</span>
          </div>
        </Link>

        {/* Right pair — cols 4-5 */}
        {sideItems[1].map((item) => {
          const isActive =
            location === item.href || location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 h-full transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="font-medium leading-none" style={LABEL_STYLE}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
