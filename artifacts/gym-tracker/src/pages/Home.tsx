import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetActiveWorkout,
  useCreateWorkout,
  useGetLevels,
  useGetProfile,
  getGetActiveWorkoutQueryKey,
} from "@workspace/api-client-react";
import { AppShell } from "@/components/layout/AppShell";
import { usePageView } from "@/hooks/usePageView";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { Dumbbell, Activity, ChevronRight, Scale, CircleHelp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { levelImage } from "@/lib/tierImages";
import gymBeamLogo from "@/assets/gymbeam-logo.png";
import { WhatsNewDialog } from "@/components/WhatsNewDialog";
import { LevelUpOverlay } from "@/components/LevelUpOverlay";
import { useLevelUpAlert } from "@/hooks/useLevelUpAlert";

export function Home() {
  usePageView("/");
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [infoOpen, setInfoOpen] = useState(false);

  const { data: activeWorkoutResponse, isLoading: isLoadingActive } = useGetActiveWorkout();
  const activeWorkout = activeWorkoutResponse?.workout;

  const { data: levelsData, isLoading: isLoadingLevels } = useGetLevels();
  const { levelUpInfo, dismissLevelUpInfo } = useLevelUpAlert(levelsData);
  const { data: profile, isLoading: isLoadingProfile } = useGetProfile();

  const createWorkout = useCreateWorkout({
    mutation: {
      onSuccess: (newWorkout) => {
        queryClient.invalidateQueries({ queryKey: getGetActiveWorkoutQueryKey() });
        setLocation(`/workout/${newWorkout.id}`);
      },
    },
  });

  const handleStartWorkout = () => {
    if (activeWorkout) {
      setLocation(`/workout/${activeWorkout.id}`);
    } else {
      createWorkout.mutate({ data: {} });
    }
  };

  const isLoading = isLoadingActive || isLoadingLevels || isLoadingProfile;

  const needsProfile = !isLoadingProfile && profile != null && profile.bodyWeightKg == null;

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full pt-20 text-muted-foreground">
          Загрузка...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WhatsNewDialog open={infoOpen} onOpenChange={setInfoOpen} />
      {levelUpInfo && (
        <LevelUpOverlay
          newLevel={levelUpInfo.level}
          levelName={levelUpInfo.name}
          onDismiss={dismissLevelUpInfo}
        />
      )}

      <div className="relative">
        {/* "?" info button — top-right corner */}
        <button
          type="button"
          onClick={() => setInfoOpen(true)}
          aria-label="Что нового"
          className="absolute top-2 right-3 z-10 p-1.5 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
        >
          <CircleHelp className="h-4 w-4" />
        </button>

        {/* Logo */}
        <div className="w-full flex flex-col items-center">
        <div className="w-full overflow-hidden" style={{ aspectRatio: "100 / 71" }}>
          <img
            src={gymBeamLogo}
            alt="GYM-BEAM"
            className="w-full h-auto"
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <p className="mt-1 mb-2 font-mono font-black tracking-[0.3em] text-sm uppercase select-none">
          <span className="text-primary">LIFT</span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="text-primary">SHINE</span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="text-primary">REPEAT</span>
        </p>
      </div>

      <div className="px-4 pb-20 space-y-3">
        {/* Profile reminder */}
        {needsProfile && (
          <button
            onClick={() => setLocation("/levels")}
            className="w-full text-left bg-amber-500/10 border border-amber-500/40 rounded-2xl p-3.5 flex items-center gap-3 active:bg-amber-500/15 transition-colors"
          >
            <Scale className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm text-foreground">Укажи свой вес</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Нормативы и уровень считаются по умолчанию (80 кг). Укажи вес для точного расчёта.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        )}

        {/* Level card */}
        {levelsData &&
          (() => {
            const cur = levelsData.levels[levelsData.currentLevel];
            const nxt = levelsData.levels[levelsData.currentLevel + 1];
            const nxtTarget = levelsData.nextLevelTonnage7dKgRequired ?? 0;
            const tonProg =
              nxt && nxtTarget > 0
                ? Math.min(
                    100,
                    (levelsData.stats.currentTonnageSinceLevelUp / nxtTarget) * 100,
                  )
                : 100;
            return (
              <button
                onClick={() => setLocation("/levels")}
                className="w-full bg-card p-3.5 rounded-2xl border border-border active:bg-accent transition-colors text-left flex items-center gap-3"
              >
                <img
                  src={levelImage(cur.level, cur.tier, levelsData.sex)}
                  alt=""
                  className="h-16 w-16 object-contain shrink-0 drop-shadow-[0_0_12px_rgba(255,80,40,0.25)]"
                  style={{ imageRendering: "pixelated", transform: levelsData.sex === "male" ? "scale(0.88)" : undefined }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="glitch-num text-xs font-mono text-primary">LVL {cur.level}</span>
                    <span className="font-bold truncate">{cur.name}</span>
                  </div>
                  {nxt ? (
                    <>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        До «{nxt.name}»:{" "}
                        {formatNumber(levelsData.stats.currentTonnageSinceLevelUp)} /{" "}
                        {formatNumber(nxtTarget)} кг
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${tonProg}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Максимальный уровень
                    </div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })()}

        {/* Hero CTA */}
        <Button
          className="glitch-hover w-full py-5 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all"
          onClick={handleStartWorkout}
          disabled={createWorkout.isPending}
        >
          {activeWorkout ? (
            <>
              <Activity className="mr-3 h-6 w-6 animate-pulse" />
              Продолжить тренировку
            </>
          ) : (
            <>
              <Dumbbell className="mr-3 h-6 w-6" />
              Начать тренировку
            </>
          )}
        </Button>
      </div>
      </div>
    </AppShell>
  );
}
