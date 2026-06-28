import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import Dashboard from "@/pages/dashboard";
import Screens from "@/pages/screens";
import ScreenDetail from "@/pages/screen-detail";
import MediaLibrary from "@/pages/media";
import Playlists from "@/pages/playlists";
import PlaylistDetail from "@/pages/playlist-detail";
import Schedules from "@/pages/schedules";
import Reports from "@/pages/reports";
import Player from "@/pages/player";
import TvEntry from "@/pages/tv";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="min-h-screen bg-sidebar flex flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.png" alt="RPShow" className="h-20 w-auto object-contain" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">RPShow Signage-on</h1>
          <p className="text-sm text-white/50 mt-1">Plataforma de gerenciamento de digital signage</p>
        </div>
      </div>
      <Button onClick={login} size="lg" className="px-8">
        Entrar na plataforma
      </Button>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sidebar flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      {/* Fullscreen routes — no auth required */}
      <Route path="/player/:code" component={Player} />
      <Route path="/tv" component={TvEntry} />

      <Route>
        <AuthGuard>
          <AppLayout>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/screens" component={Screens} />
              <Route path="/screens/:id" component={ScreenDetail} />
              <Route path="/media" component={MediaLibrary} />
              <Route path="/playlists" component={Playlists} />
              <Route path="/playlists/:id" component={PlaylistDetail} />
              <Route path="/schedules" component={Schedules} />
              <Route path="/reports" component={Reports} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
