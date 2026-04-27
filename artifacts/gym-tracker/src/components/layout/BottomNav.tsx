import { Link, useLocation } from "wouter";
import { Home, Clock, BarChart2, Dumbbell, Trophy, ClipboardList } from "lucide-react";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Главная" },
    { href: "/programs", icon: ClipboardList, label: "Программа" },
    { href: "/history", icon: Clock, label: "История" },
    { href: "/levels", icon: Trophy, label: "Уровни" },
    { href: "/stats", icon: BarChart2, label: "Статистика" },
    { href: "/exercises", icon: Dumbbell, label: "Упражнения" },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 border-t border-border bg-card z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <nav className="grid grid-cols-6 h-16 items-center px-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center justify-center h-full gap-1 px-0.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="w-full truncate text-center text-[9px] font-medium leading-none sm:text-[10px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
