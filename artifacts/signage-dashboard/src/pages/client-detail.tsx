import { useRoute, Link } from "wouter";
import { 
  useGetClient, 
  useListScreens, 
  useListPlaylists,
  getGetClientQueryKey,
  getListScreensQueryKey,
  getListPlaylistsQueryKey
} from "@workspace/api-client-react";
import { Building2, MapPin, Monitor, ListVideo, Phone, User, Activity, Clock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function ClientDetail() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;

  const { data: client, isLoading: clientLoading } = useGetClient(id, { 
    query: { enabled: !!id, queryKey: getGetClientQueryKey(id) } 
  });
  
  const { data: screens, isLoading: screensLoading } = useListScreens({ clientId: id }, {
    query: { enabled: !!id, queryKey: getListScreensQueryKey({ clientId: id }) }
  });
  
  const { data: playlists, isLoading: playlistsLoading } = useListPlaylists({ clientId: id }, {
    query: { enabled: !!id, queryKey: getListPlaylistsQueryKey({ clientId: id }) }
  });

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold">Client not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/clients">Return to Clients</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
          <Link href="/clients">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Clients
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
              {!client.active && (
                <Badge variant="secondary" className="bg-muted">Inactive</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <Badge variant="outline" className="font-normal capitalize">
                {client.type.replace('_', ' ')}
              </Badge>
              <span className="text-sm">Since {new Date(client.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Contact Person</p>
                <p className="text-sm text-muted-foreground">{client.contactName || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">{client.contactPhone || "Not provided"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{client.address || "Not provided"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Screens</CardTitle>
              <CardDescription>Devices registered to this client</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/screens?client=${client.id}`}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {screensLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : screens && screens.length > 0 ? (
              <div className="space-y-3">
                {screens.slice(0, 5).map(screen => (
                  <div key={screen.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/screens/${screen.id}`}>
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{screen.name}</p>
                        <p className="text-xs text-muted-foreground">{screen.location || "No location"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={
                        screen.status === 'online' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 
                        screen.status === 'offline' ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                        'bg-muted text-muted-foreground'
                      }>
                        {screen.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {screens.length > 5 && (
                  <p className="text-center text-xs text-muted-foreground mt-4 pt-2 border-t">
                    + {screens.length - 5} more screens
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Monitor className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No screens registered</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Playlists</CardTitle>
              <CardDescription>Content sequences for this client</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/playlists?client=${client.id}`}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {playlistsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : playlists && playlists.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {playlists.map(playlist => (
                  <div key={playlist.id} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group" onClick={() => window.location.href = `/playlists/${playlist.id}`}>
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <ListVideo className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{playlist.name}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {playlist.itemCount} items
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round((playlist.totalDurationSeconds || 0) / 60)} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <ListVideo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No playlists created</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
