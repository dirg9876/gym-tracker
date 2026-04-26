import { UserButton } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground pb-20">
      <header className="w-full max-w-md mx-auto flex items-center justify-end px-4 pt-3 pb-1">
        <UserButton
          appearance={{ theme: shadcn, cssLayerName: "clerk" }}
        />
      </header>
      <main className="flex-1 w-full max-w-md mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
