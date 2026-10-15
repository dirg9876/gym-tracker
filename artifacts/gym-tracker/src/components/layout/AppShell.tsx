import { UserButton } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { BottomNav } from "./BottomNav";
import { GymBeamBanner } from "./GymBeamBanner";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useGetActiveWorkout } from "@workspace/api-client-react";

const APP_VERSION = "0.4.0";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: activeWorkoutData } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutData?.workout;
  const isOnWorkoutPage = location.startsWith("/workout/");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header
        className={`sticky top-0 z-20 w-full bg-background transition-colors ${
          scrolled ? "border-b border-border" : ""
        }`}
        style={{ overflow: "visible" }}
      >
        <div className="flex items-center px-4 pt-2 pb-1 gap-3">
          {/* Banner — takes all space, mascot overflows down for depth */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <GymBeamBanner onClick={() => setLocation("/")} />

            {/* Active workout pill sits right after the banner */}
            {activeWorkout && !isOnWorkoutPage && (
              <button
                onClick={() => setLocation(`/workout/${activeWorkout.id}`)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/15 border border-primary/25 text-primary active:bg-primary/25 transition-colors shrink-0"
                aria-label="Продолжить тренировку"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-[10px] font-bold leading-none">Идёт</span>
              </button>
            )}
          </div>

          {/* Profile — always at the far right edge */}
          <div className="shrink-0">
            <UserButton
              appearance={{ theme: shadcn, cssLayerName: "clerk" }}
            />
          </div>
        </div>
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
