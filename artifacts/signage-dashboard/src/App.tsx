import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
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
import Devices from "@/pages/devices";
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
import FinanceiroAdmin from "@/pages/financeiro-admin";
import PendingApproval from "@/pages/pending-approval";

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

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-white/50" />
    </div>
  );
}

/**
 * All routes that require authentication go through here.
 * Auth is checked ONCE. Role determines which route set is shown.
 * No nested guards, no redirect loops.
 */
function AuthenticatedApp() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    window.location.replace("/login");
    return null;
  }

  const role = (user as any)?.role as string;
  const subscriptionStatus = (user as any)?.subscriptionStatus as string;

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (role === "admin") {
    return (
      <ErrorBoundary>
        <AppLayout>
          <Switch>
            <Route path="/">
              <Redirect to="/admin" />
            </Route>
            <Route path="/admin" component={AdminPanel} />
            <Route path="/users" component={Users} />
            <Route path="/devices" component={Devices} />
            <Route path="/financeiro-admin" component={FinanceiroAdmin} />
            <Route path="/reports-admin" component={Reports} />
            <Route path="/security-admin" component={Security} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </ErrorBoundary>
    );
  }

  // ── PENDING APPROVAL ────────────────────────────────────────────────────────
  if (subscriptionStatus === "pending_approval") {
    return <PendingApproval />;
  }

  // ── OPERATOR ────────────────────────────────────────────────────────────────

  // Fullscreen routes (no sidebar)
  if (location === "/schedules") {
    return (
      <ErrorBoundary>
        <AppLayout fullscreen>
          <Schedules />
        </AppLayout>
      </ErrorBoundary>
    );
  }

  if (location.startsWith("/playlists/")) {
    return (
      <ErrorBoundary>
        <AppLayout fullscreen>
          <PlaylistDetail />
        </AppLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/screens" component={Screens} />
          <Route path="/screens/:id" component={ScreenDetail} />
          <Route path="/devices" component={Devices} />
          <Route path="/media" component={MediaLibrary} />
          <Route path="/playlists" component={Playlists} />
          <Route path="/reports" component={Reports} />
          <Route path="/security" component={Security} />
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/monitoring" component={Monitoring} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </ErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes — no auth needed */}
      <Route path="/login" component={Login} />
      <Route path="/player/:code" component={Player} />
      <Route path="/tv" component={TvEntry} />

      {/* All other routes require auth — handled inside AuthenticatedApp */}
      <Route>
        <AuthenticatedApp />
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
