import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@workspace/replit-auth-web";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import React from "react";

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
import Login from "@/pages/login";
import Users from "@/pages/users";
import Monitoring from "@/pages/monitoring";
import Security from "@/pages/security";
import AdminPanel from "@/pages/admin";
import Financeiro from "@/pages/financeiro";

function handle401(error: unknown) {
  if (error && typeof error === "object" && "status" in error && (error as { status: number }).status === 401) {
    window.location.href = "/login";
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-sidebar flex flex-col items-center justify-center gap-6 px-6">
          <AlertTriangle className="w-12 h-12 text-yellow-400" />
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">Algo deu errado</h2>
            <p className="text-sm text-white/50 max-w-sm">
              {this.state.error.message || "Ocorreu um erro inesperado."}
            </p>
          </div>
          <Button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Recarregar página
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
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
    window.location.replace("/login");
    return null;
  }

  return <>{children}</>;
}

/** Redirects admin users away from operator-only routes → /admin */
function OperatorOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if ((user as any)?.role === "admin") return <Redirect to="/admin" />;
  return <>{children}</>;
}

/** Redirects non-admin users away from admin-only routes → / */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if ((user as any)?.role !== "admin") return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/player/:code" component={Player} />
      <Route path="/tv" component={TvEntry} />

      <Route path="/schedules">
        <AuthGuard>
          <OperatorOnly>
            <AppLayout fullscreen>
              <ErrorBoundary>
                <Schedules />
              </ErrorBoundary>
            </AppLayout>
          </OperatorOnly>
        </AuthGuard>
      </Route>

      <Route path="/playlists/:id">
        <AuthGuard>
          <OperatorOnly>
            <AppLayout fullscreen>
              <ErrorBoundary>
                <PlaylistDetail />
              </ErrorBoundary>
            </AppLayout>
          </OperatorOnly>
        </AuthGuard>
      </Route>

      <Route>
        <AuthGuard>
          <AppLayout>
            <ErrorBoundary>
              <Switch>
                {/* Operator-only routes */}
                <Route path="/">
                  <OperatorOnly><Dashboard /></OperatorOnly>
                </Route>
                <Route path="/screens">
                  <OperatorOnly><Screens /></OperatorOnly>
                </Route>
                <Route path="/screens/:id">
                  <OperatorOnly><ScreenDetail /></OperatorOnly>
                </Route>
                <Route path="/media">
                  <OperatorOnly><MediaLibrary /></OperatorOnly>
                </Route>
                <Route path="/playlists">
                  <OperatorOnly><Playlists /></OperatorOnly>
                </Route>
                <Route path="/reports">
                  <OperatorOnly><Reports /></OperatorOnly>
                </Route>
                <Route path="/security">
                  <OperatorOnly><Security /></OperatorOnly>
                </Route>
                <Route path="/financeiro">
                  <OperatorOnly><Financeiro /></OperatorOnly>
                </Route>
                {/* Shared: monitoring visible to both */}
                <Route path="/monitoring" component={Monitoring} />
                {/* Admin-only routes */}
                <Route path="/users">
                  <AdminOnly><Users /></AdminOnly>
                </Route>
                <Route path="/admin">
                  <AdminOnly><AdminPanel /></AdminOnly>
                </Route>
                <Route component={NotFound} />
              </Switch>
            </ErrorBoundary>
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
