import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-20">
      <main className="flex-1 w-full max-w-md mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
