import { useState, useRef } from "react";
import { 
  useListMedia, 
  useCreateMedia, 
  useDeleteMedia,
  useListClients,
  useRequestUploadUrl,
  getListMediaQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Image as ImageIcon, Search, Plus, Film, Clock, Link as LinkIcon, Trash2, Upload } from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["image", "video"]),
  url: z.string().min(1, "URL is required"),
  durationSeconds: z.coerce.number().min(1).optional(),
  clientId: z.coerce.number().optional().or(z.literal(0)),
});

type MediaFormValues = z.infer<typeof formSchema>;

export default function MediaLibrary() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const objectPathMap = useRef(new Map<string, string>());

  const { data: media, isLoading } = useListMedia();
  const { data: clients } = useListClients();
  const createMedia = useCreateMedia();
  const deleteMedia = useDeleteMedia();
  const requestUploadUrl = useRequestUploadUrl();

  const form = useForm<MediaFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "image",
      url: "",
      durationSeconds: 10,
      clientId: 0, // Default to shared
    },
  });

  const watchType = form.watch("type");

  const onSubmit = (data: MediaFormValues) => {
    // If it's a video, duration might be managed by the player, but we can store an estimate
    const payload = { ...data };
    if (payload.clientId === 0) {
      delete payload.clientId; // Remove if 0 to make it shared
    }

    createMedia.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
          setIsUploadOpen(false);
          form.reset();
          toast({ title: "Media added successfully" });
        },
        onError: () => {
          toast({ title: "Failed to add media", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this media? It will be removed from all playlists.")) {
      deleteMedia.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
            toast({ title: "Media deleted" });
          },
          onError: () => {
            toast({ title: "Failed to delete media", variant: "destructive" });
          },
        }
      );
    }
  };

  const filteredMedia = media?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground mt-1">Manage images and videos for your screens.</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <ObjectUploader
            maxNumberOfFiles={10}
            maxFileSize={104857600}
            onGetUploadParameters={async (file) => {
              const res = await requestUploadUrl.mutateAsync({
                data: {
                  name: file.name,
                  size: file.size ?? 0,
                  contentType: file.type ?? "application/octet-stream",
                },
              });
              objectPathMap.current.set(file.id, res.objectPath);
              return { method: "PUT" as const, url: res.uploadURL };
            }}
            onComplete={(result) => {
              result.successful?.forEach((file) => {
                const objectPath = objectPathMap.current.get(file.id);
                if (!objectPath) return;
                const isVideo = file.type?.startsWith("video/") ?? false;
                createMedia.mutate(
                  {
                    data: {
                      name: file.name,
                      type: isVideo ? "video" : "image",
                      url: objectPath,
                      durationSeconds: isVideo ? undefined : 10,
                    },
                  },
                  {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
                    },
                  }
                );
              });
              if ((result.successful?.length ?? 0) > 0) {
                toast({ title: `${result.successful?.length} file(s) uploaded successfully` });
              }
            }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload Files
            </span>
          </ObjectUploader>

          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="shrink-0 gap-2">
                <Plus className="w-4 h-4" />
                Add Media URL
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Media from URL</DialogTitle>
              <DialogDescription>
                Provide a direct link to an image (.jpg, .png) or video (.mp4).
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direct URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/image.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Summer Promo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {watchType === "image" && (
                  <FormField
                    control={form.control}
                    name="durationSeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Duration (Seconds)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>How long to show this image by default</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to Client (Optional)</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Shared across all clients" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Shared (Available to all)</SelectItem>
                          {clients?.map((client) => (
                            <SelectItem key={client.id} value={client.id.toString()}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={createMedia.isPending}>
                    {createMedia.isPending ? "Adding..." : "Add Media"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-card p-2 rounded-lg border">
        <Tabs value={typeFilter} onValueChange={setTypeFilter} className="w-full sm:w-auto">
          <TabsList>
            <TabsTrigger value="all">All Media</TabsTrigger>
            <TabsTrigger value="image">Images</TabsTrigger>
            <TabsTrigger value="video">Videos</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search media..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="aspect-square w-full rounded-xl" />)}
        </div>
      ) : filteredMedia?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-dashed">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No media found</h3>
          <p className="text-muted-foreground mt-1">Upload images or videos to build your library.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredMedia?.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                {item.type === 'video' ? (
                  <div className="w-full h-full relative">
                    <video src={item.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      <Film className="w-8 h-8 text-white opacity-80" />
                    </div>
                  </div>
                ) : (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                )}
                
                {/* Actions overlay */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5">
                  <Button size="icon" variant="destructive" className="h-8 w-8 shadow-sm" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Badges overlay */}
                <div className="absolute bottom-2 left-2 flex gap-1.5">
                  <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-sm text-[10px] px-1.5 py-0">
                    {item.type.toUpperCase()}
                  </Badge>
                  {item.durationSeconds && (
                    <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm shadow-sm text-[10px] px-1.5 py-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {item.durationSeconds}s
                    </Badge>
                  )}
                </div>
              </div>
              <CardContent className="p-3">
                <p className="font-medium text-sm line-clamp-1" title={item.name}>{item.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground truncate flex-1 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    {item.url}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
