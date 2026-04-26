import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";

export function Profile() {
  const [, setLocation] = useLocation();

  return (
    <AppShell>
      <div className="p-4 space-y-6 pb-24">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mt-2"
          onClick={() => setLocation("/levels")}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Уровни
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">Профиль</h1>
          <p className="text-sm text-muted-foreground">
            Вес, рост и пол нужны для точных нормативов и упражнений с
            собственным весом.
          </p>
        </div>

        <ProfileCard />
      </div>
    </AppShell>
  );
}
