import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Home } from "@/pages/Home";
import { ActiveWorkout } from "@/pages/ActiveWorkout";
import { WorkoutReport } from "@/pages/WorkoutReport";
import { History } from "@/pages/History";
import { HistoryDetail } from "@/pages/HistoryDetail";
import { Stats } from "@/pages/Stats";
import { Exercises } from "@/pages/Exercises";
import { ExerciseProgress } from "@/pages/ExerciseProgress";
import { Levels } from "@/pages/Levels";
import { Programs } from "@/pages/Programs";
import { ProgramDetail } from "@/pages/ProgramDetail";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/workout/:id" component={ActiveWorkout} />
      <Route path="/workout/:id/report" component={WorkoutReport} />
      <Route path="/history" component={History} />
      <Route path="/history/:id" component={HistoryDetail} />
      <Route path="/stats" component={Stats} />
      <Route path="/exercises" component={Exercises} />
      <Route path="/exercises/:id" component={ExerciseProgress} />
      <Route path="/levels" component={Levels} />
      <Route path="/programs" component={Programs} />
      <Route path="/programs/:id" component={ProgramDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Enforce dark mode on body
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('dark');
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster theme="dark" position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
