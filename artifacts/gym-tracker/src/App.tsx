import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Link } from "wouter";

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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "bottom" as const,
  },
  variables: {
    colorPrimary: "#ff3d1a",
    colorForeground: "#fafafa",
    colorMutedForeground: "#71717a",
    colorDanger: "#ef4444",
    colorBackground: "#0f0f0f",
    colorInput: "#1c1c1c",
    colorInputForeground: "#fafafa",
    colorNeutral: "#27272a",
    fontFamily: "'Inter', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-[#111111] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#27272a]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#fafafa]",
    headerSubtitle: "text-[#71717a]",
    socialButtonsBlockButtonText: "text-[#fafafa]",
    formFieldLabel: "text-[#fafafa]",
    footerActionLink: "text-[#ff3d1a]",
    footerActionText: "text-[#71717a]",
    dividerText: "text-[#71717a]",
    identityPreviewEditButton: "text-[#ff3d1a]",
    formFieldSuccessText: "text-[#22c55e]",
    alertText: "text-[#fafafa]",
    logoBox: "mx-auto",
    logoImage: "h-10 w-auto mx-auto",
    socialButtonsBlockButton: "border-[#27272a] bg-[#1c1c1c] hover:bg-[#27272a]",
    formButtonPrimary: "bg-[#ff3d1a] hover:bg-[#e03518] text-white",
    formFieldInput: "bg-[#1c1c1c] border-[#27272a] text-[#fafafa]",
    footerAction: "border-t border-[#27272a]",
    dividerLine: "bg-[#27272a]",
    alert: "border-[#27272a]",
    otpCodeFieldInput: "bg-[#1c1c1c] border-[#27272a] text-[#fafafa]",
    formFieldRow: "gap-2",
    main: "gap-4",
  },
};

const clerkLocalization = {
  signIn: {
    start: {
      title: "С возвращением",
      subtitle: "Войди, чтобы продолжить тренировки",
    },
  },
  signUp: {
    start: {
      title: "Создай аккаунт",
      subtitle: "Начни отслеживать тренировки уже сегодня",
    },
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        appearance={clerkAppearance}
      />
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center">
      <img
        src={`${basePath}/logo.svg`}
        alt="Тренировки"
        className="h-16 w-16 mb-6"
      />
      <h1 className="text-3xl font-bold tracking-tight mb-2">Тренировки</h1>
      <p className="text-muted-foreground text-sm mb-10 max-w-xs">
        Трекер тренировок для спортсменов. Отслеживай подходы, прогресс и уровень силы.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/sign-in"
          className="w-full inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-semibold py-3 px-6 hover:bg-primary/90 transition-colors"
        >
          Войти
        </Link>
        <Link
          href="/sign-up"
          className="w-full inline-flex items-center justify-center rounded-xl border border-border bg-card text-foreground font-semibold py-3 px-6 hover:bg-accent/40 transition-colors"
        >
          Зарегистрироваться
        </Link>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function HomeRoute() {
  return (
    <>
      <Show when="signed-in">
        <Home />
      </Show>
      <Show when="signed-out">
        <Landing />
      </Show>
    </>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/workout/:id">
        {(p) => <Protected><ActiveWorkout {...p} /></Protected>}
      </Route>
      <Route path="/workout/:id/report">
        {(p) => <Protected><WorkoutReport {...p} /></Protected>}
      </Route>
      <Route path="/history">
        {() => <Protected><History /></Protected>}
      </Route>
      <Route path="/history/:id">
        {(p) => <Protected><HistoryDetail {...p} /></Protected>}
      </Route>
      <Route path="/stats">
        {() => <Protected><Stats /></Protected>}
      </Route>
      <Route path="/exercises">
        {() => <Protected><Exercises /></Protected>}
      </Route>
      <Route path="/exercises/:id">
        {(p) => <Protected><ExerciseProgress {...p} /></Protected>}
      </Route>
      <Route path="/levels">
        {() => <Protected><Levels /></Protected>}
      </Route>
      <Route path="/programs">
        {() => <Protected><Programs /></Protected>}
      </Route>
      <Route path="/programs/:id">
        {(p) => <Protected><ProgramDetail {...p} /></Protected>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRouter />
          <Toaster theme="dark" position="top-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
