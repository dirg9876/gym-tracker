import { useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [, setLocation] = useLocation();

  const initials = user
    ? (user.firstName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()
    : "U";

  const handleSignOut = () => {
    signOut(() => setLocation("/"));
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-20">
      <header className="w-full max-w-md mx-auto flex items-center justify-end px-4 pt-3 pb-1">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          aria-label="Выйти"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold">
            {initials}
          </span>
          <span>Выйти</span>
        </button>
      </header>
      <main className="flex-1 w-full max-w-md mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
