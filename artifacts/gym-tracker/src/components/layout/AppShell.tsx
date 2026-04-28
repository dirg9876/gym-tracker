import { UserButton } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { BottomNav } from "./BottomNav";
import { useLocation } from "wouter";

const APP_VERSION = "0.1.0";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-20">
      <header className="w-full max-w-md mx-auto flex items-center justify-between px-4 pt-3 pb-1">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-1.5 active:opacity-70 transition-opacity"
          aria-label="На главную"
        >
          <span className="font-black text-base tracking-tight leading-none">
            GYM<span className="text-primary">-BEAM</span>
          </span>
        </button>
        <UserButton
          appearance={{ theme: shadcn, cssLayerName: "clerk" }}
        />
      </header>
      <main className="flex-1 w-full max-w-md mx-auto">
        {children}
      </main>
      <BottomNav />
      <div className="fixed bottom-[4.5rem] left-3 pointer-events-none z-10">
        <span className="text-[10px] text-muted-foreground/35 font-mono select-none">
          v{APP_VERSION}
        </span>
      </div>
    </div>
  );
}
