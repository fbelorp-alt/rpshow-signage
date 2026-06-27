import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetPlaylist, 
  useListMedia,
  useAddPlaylistItem,
  useRemovePlaylistItem,
  getGetPlaylistQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Film, Image as ImageIcon, GripVertical, Plus, Trash2, Save, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";

export default function PlaylistDetail() {
  const [, params] = useRoute("/playlists/:id");
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchMedia, setSearchMedia] = useState("");
  
  // Custom duration override for adding media
  const [durationOverride, setDurationOverride] = useState<Record<number, number>>({});

  const { data: playlist, isLoading: playlistLoading } = useGetPlaylist(id, { 
    query: { enabled: !!id, queryKey: getGetPlaylistQueryKey(id) } 
  });
  
  const { data: mediaItems, isLoading: mediaLoading } = useListMedia(
    // If playlist is assigned to a client, only show their media + shared media
    // For simplicity we fetch all and filter in JS if needed
    {},
    { query: { enabled: !!id } }
  );

  const addPlaylistItem = useAddPlaylistItem();
  const removePlaylistItem = useRemovePlaylistItem();

  // Sort items by position
  const items = [...(playlist?.items || [])].sort((a, b) => a.position - b.position);

  const handleAddItem = (mediaId: number, defaultDuration: number) => {
    const duration = durationOverride[mediaId] || defaultDuration || 10;
    // Calculate next position
    const nextPos = items.length > 0 ? Math.max(...items.map(i => i.position)) + 1 : 0;
    
    addPlaylistItem.mutate(
      { id, data: { mediaId, durationSeconds: duration, position: nextPos } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          toast({ title: "Item added" });
        }
      }
    );
  };

  const handleRemoveItem = (itemId: number) => {
    removePlaylistItem.mutate(
      { id, itemId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPlaylistQueryKey(id) });
          toast({ title: "Item removed" });
        }
      }
    );
  };

  const filteredMedia = mediaItems?.filter(m => 
    m.name.toLowerCase().includes(searchMedia.toLowerCase()) &&
    // Show shared media (0 or null) or media belonging to the playlist's client
    (!playlist?.clientId || !m.clientId || m.clientId === playlist.clientId)
  );

  if (playlistLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[500px] w-full mt-8" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold">Playlist not found</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/playlists">Return to Playlists</Link>
        </Button>
      </div>
    );
  }

  const totalDuration = items.reduce((sum, item) => sum + item.durationSeconds, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="-ml-2 shrink-0">
            <Link href="/playlists"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{playlist.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1"><Film className="w-3.5 h-3.5" /> {items.length} items</span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> 
                {Math.floor(totalDuration / 60)}m {totalDuration % 60}s
              </span>
            </p>
          </div>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Media
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Media to Playlist</DialogTitle>
              <DialogDescription>
                Select items from your library to append to this sequence.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-2 relative">
              <Input 
                placeholder="Search library..." 
                value={searchMedia}
                onChange={e => setSearchMedia(e.target.value)}
                className="w-full"
              />
            </div>
            
            <ScrollArea className="flex-1 -mx-6 px-6">
              {mediaLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : filteredMedia?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No matching media found in library.
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {filteredMedia?.map(media => (
                    <div key={media.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0 relative">
                          {media.type === 'video' ? (
                            <div className="w-full h-full bg-black/80 flex items-center justify-center">
                              <Film className="w-5 h-5 text-white/50" />
                            </div>
                          ) : (
                            <img src={media.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm truncate" title={media.name}>{media.name}</p>
                          <Badge variant="outline" className="text-[10px] uppercase mt-1">
                            {media.type}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Duration (s)</span>
                          <Input 
                            type="number" 
                            className="w-20 h-8 text-sm text-right"
                            placeholder={media.durationSeconds?.toString() || "10"}
                            value={durationOverride[media.id] || media.durationSeconds || 10}
                            onChange={(e) => setDurationOverride({
                              ...durationOverride, 
                              [media.id]: parseInt(e.target.value) || 10
                            })}
                          />
                        </div>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => handleAddItem(media.id, media.durationSeconds || 10)}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="bg-muted/50 border-b px-4 py-3 grid grid-cols-12 gap-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6">Content</div>
          <div className="col-span-3 text-right">Duration</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-20 px-4 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Play className="w-6 h-6 text-muted-foreground translate-x-0.5" />
            </div>
            <h3 className="text-lg font-medium">Playlist is empty</h3>
            <p className="text-muted-foreground mt-1 max-w-sm mb-6">
              Add media items to build your sequence. They will play in order and repeat automatically.
            </p>
            <Button onClick={() => setIsAddOpen(true)}>Add First Item</Button>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={item.id} className="group flex items-center px-4 py-3 bg-card hover:bg-accent/20 transition-colors">
                <div className="grid grid-cols-12 gap-4 w-full items-center">
                  <div className="col-span-1 flex items-center justify-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/30 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="font-mono text-sm text-muted-foreground">{idx + 1}</span>
                  </div>
                  
                  <div className="col-span-6 flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-9 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0 border">
                      {item.mediaType === 'video' ? (
                        <Film className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <img src={item.mediaUrl || ''} className="w-full h-full object-cover" alt="" />
                      )}
                    </div>
                    <div className="truncate min-w-0">
                      <p className="font-medium text-sm truncate" title={item.mediaName || "Unknown"}>{item.mediaName || "Unknown Media"}</p>
                      <p className="text-xs text-muted-foreground uppercase">{item.mediaType}</p>
                    </div>
                  </div>
                  
                  <div className="col-span-3 flex items-center justify-end text-sm">
                    <span className="bg-muted px-2 py-1 rounded-md border font-mono">
                      {item.durationSeconds}s
                    </span>
                  </div>
                  
                  <div className="col-span-2 flex items-center justify-end">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
