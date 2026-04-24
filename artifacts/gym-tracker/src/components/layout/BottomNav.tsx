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
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/90 backdrop-blur-md pb-safe z-50">
      <nav className="flex h-16 items-center justify-around px-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center flex-1 min-w-0 h-full space-y-1 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
