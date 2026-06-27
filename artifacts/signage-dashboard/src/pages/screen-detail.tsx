import { useRoute, Link } from "wouter";
import { 
  useGetScreen, 
  useListSchedules,
  getGetScreenQueryKey,
  getListSchedulesQueryKey
} from "@workspace/api-client-react";
import { Monitor, ArrowLeft, Building2, MapPin, Hash, Activity, Clock, PlaySquare, Copy, ExternalLink, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function ScreenDetail() {
  const [, params] = useRoute("/screens/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const { toast } = useToast();

  const { data: screen, isLoading: screenLoading } = useGetScreen(id, { 
    query: { enabled: !!id, queryKey: getGetScreenQueryKey(id) } 
  });
  
  const { data: schedules, isLoading: schedulesLoading } = useListSchedules({ screenId: id }, {
    query: { enabled: !!id, queryKey: getListSchedulesQueryKey({ screenId: id }) }
  });

  if (screenLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold">Screen not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/screens">Return to Screens</Link>
        </Button>
      </div>
    );
  }

  const playerUrl = `${window.location.origin}/player/${screen.code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(playerUrl);
    toast({ title: "Player URL copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href="/screens">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Screens
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-6">
        <div className="flex items-start gap-4">
          <div className="relative mt-1">
            <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Monitor className="w-8 h-8" />
            </div>
            <div className={cn(
              "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-background",
              screen.status === 'online' ? "bg-emerald-500" :
              screen.status === 'offline' ? "bg-destructive" :
              "bg-muted-foreground"
            )} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{screen.name}</h1>
            <div className="flex items-center gap-3 mt-2 text-muted-foreground">
              <span className="flex items-center gap-1.5 text-sm">
                <Building2 className="w-4 h-4" />
                <Link href={`/clients/${screen.clientId}`} className="hover:text-primary hover:underline transition-colors">
                  {screen.clientName}
                </Link>
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5 text-sm">
                <MapPin className="w-4 h-4" />
                {screen.location || "No location set"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyToClipboard} className="gap-2">
            <Copy className="w-4 h-4" />
            Copy URL
          </Button>
          <Button asChild className="gap-2">
            <a href={`/player/${screen.code}`} target="_blank" rel="noreferrer">
              <ExternalLink className="w-4 h-4" />
              Open Player
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Device Connection</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg border text-center">
              <p className="text-sm text-muted-foreground mb-2">Pairing Code</p>
              <code className="text-3xl font-mono font-bold tracking-widest text-primary">
                {screen.code}
              </code>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-muted-foreground">Status</span>
                <span className={cn(
                  "font-medium capitalize",
                  screen.status === 'online' ? "text-emerald-600" :
                  screen.status === 'offline' ? "text-destructive" :
                  "text-muted-foreground"
                )}>{screen.status}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="text-muted-foreground">Last Seen</span>
                <span className="font-medium">
                  {screen.lastSeen ? new Date(screen.lastSeen).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Registered</span>
                <span className="font-medium">{new Date(screen.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Assigned Schedules</CardTitle>
              <CardDescription>What plays when on this screen</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/schedules">Manage Schedules</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {schedulesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : schedules && schedules.length > 0 ? (
              <div className="space-y-3">
                {schedules.map(schedule => (
                  <div key={schedule.id} className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-colors",
                    schedule.active ? "bg-card hover:bg-accent/50" : "bg-muted/50 opacity-70"
                  )}>
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        <PlaySquare className={cn("w-5 h-5", schedule.active ? "text-primary" : "text-muted-foreground")} />
                      </div>
                      <div>
                        <Link href={`/playlists/${schedule.playlistId}`} className="font-medium text-base hover:underline hover:text-primary transition-colors">
                          {schedule.playlistName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {schedule.startTime || '00:00'} - {schedule.endTime || '23:59'}
                          </span>
                          {schedule.daysOfWeek && (
                            <>
                              <span>&bull;</span>
                              <span>Days: {schedule.daysOfWeek}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <Badge variant={schedule.active ? "default" : "secondary"}>
                        {schedule.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground">No schedules assigned</p>
                <p className="text-sm mt-1">This screen will show the default fallback content.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link href="/schedules">Assign a Playlist</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
