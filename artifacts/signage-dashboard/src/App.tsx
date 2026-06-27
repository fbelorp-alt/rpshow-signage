import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";

import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import ClientDetail from "@/pages/client-detail";
import Screens from "@/pages/screens";
import ScreenDetail from "@/pages/screen-detail";
import MediaLibrary from "@/pages/media";
import Playlists from "@/pages/playlists";
import PlaylistDetail from "@/pages/playlist-detail";
import Schedules from "@/pages/schedules";
import Player from "@/pages/player";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Player route is outside the AppLayout (fullscreen, no chrome) */}
      <Route path="/player/:code" component={Player} />
      
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/clients" component={Clients} />
            <Route path="/clients/:id" component={ClientDetail} />
            <Route path="/screens" component={Screens} />
            <Route path="/screens/:id" component={ScreenDetail} />
            <Route path="/media" component={MediaLibrary} />
            <Route path="/playlists" component={Playlists} />
            <Route path="/playlists/:id" component={PlaylistDetail} />
            <Route path="/schedules" component={Schedules} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
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
