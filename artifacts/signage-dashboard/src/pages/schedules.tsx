import { useRoute, Link } from "wouter";
import { 
  useListSchedules, 
  useCreateSchedule, 
  useDeleteSchedule,
  useUpdateSchedule,
  useListScreens,
  useListPlaylists,
  getListSchedulesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { CalendarClock, Plus, MoreVertical, Monitor, ListVideo, Clock, Calendar as CalendarIcon, Play, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useState } from "react";

const formSchema = z.object({
  screenId: z.coerce.number().min(1, "Screen is required"),
  playlistId: z.coerce.number().min(1, "Playlist is required"),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  daysOfWeek: z.string().optional(), // "0,1,2,3,4,5,6"
});

type ScheduleFormValues = z.infer<typeof formSchema>;

export default function Schedules() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: schedules, isLoading } = useListSchedules();
  const { data: screens, isLoading: screensLoading } = useListScreens();
  const { data: playlists, isLoading: playlistsLoading } = useListPlaylists();
  
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      screenId: undefined as unknown as number,
      playlistId: undefined as unknown as number,
      startTime: "00:00",
      endTime: "23:59",
      daysOfWeek: "0,1,2,3,4,5,6", // All days
    },
  });

  const onSubmit = (data: ScheduleFormValues) => {
    createSchedule.mutate(
      { data: { ...data, active: true } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Schedule created" });
        },
        onError: () => {
          toast({ title: "Failed to create schedule", variant: "destructive" });
        },
      }
    );
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    updateSchedule.mutate(
      { id, data: { active: !currentActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
          toast({ title: `Schedule ${!currentActive ? 'activated' : 'paused'}` });
        }
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this schedule?")) {
      deleteSchedule.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
            toast({ title: "Schedule deleted" });
          }
        }
      );
    }
  };

  const formatDays = (daysCsv?: string | null) => {
    if (!daysCsv) return "All Days";
    if (daysCsv === "0,1,2,3,4,5,6") return "Everyday";
    if (daysCsv === "1,2,3,4,5") return "Weekdays";
    if (daysCsv === "0,6") return "Weekends";
    
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return daysCsv.split(',').map(d => dayNames[parseInt(d)]).join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground mt-1">Control what plays on which screens and when.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="w-4 h-4" />
              New Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Playlist to Screen</DialogTitle>
              <DialogDescription>
                Create a schedule rule for playback.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="screenId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Screen</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select screen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {screensLoading ? (
                            <div className="p-2 text-sm">Loading...</div>
                          ) : screens?.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="playlistId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Content Playlist</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select playlist" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {playlistsLoading ? (
                            <div className="p-2 text-sm">Loading...</div>
                          ) : playlists?.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="daysOfWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Days of Week (0=Sun, 6=Sat)</FormLabel>
                      <FormControl>
                        <Input placeholder="0,1,2,3,4,5,6" {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated list of days</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={createSchedule.isPending}>
                    {createSchedule.isPending ? "Creating..." : "Save Schedule"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : schedules?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-lg border border-dashed">
          <CalendarClock className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No schedules configured</h3>
          <p className="text-muted-foreground mt-1">Assign playlists to screens to start playing content.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {schedules?.map(schedule => (
            <Card key={schedule.id} className={cn(
              "transition-colors",
              !schedule.active && "opacity-70 bg-muted/30"
            )}>
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-4">
                  {/* Status Indicator */}
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <CalendarClock className={cn("w-6 h-6", schedule.active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <div className="md:col-span-5 space-y-1">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Link href={`/screens/${schedule.screenId}`} className="font-medium hover:underline">
                          {schedule.screenName}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ListVideo className="w-4 h-4 shrink-0" />
                        <Link href={`/playlists/${schedule.playlistId}`} className="hover:text-foreground transition-colors">
                          {schedule.playlistName}
                        </Link>
                      </div>
                    </div>
                    
                    <div className="md:col-span-5 grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span>{schedule.startTime || "00:00"} - {schedule.endTime || "23:59"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate" title={formatDays(schedule.daysOfWeek)}>
                          {formatDays(schedule.daysOfWeek)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="md:col-span-2 flex items-center justify-end sm:justify-start gap-2">
                      <Badge variant={schedule.active ? "default" : "secondary"}>
                        {schedule.active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleActive(schedule.id, schedule.active || false)}>
                          {schedule.active ? (
                            <><Pause className="w-4 h-4 mr-2" /> Pause Schedule</>
                          ) : (
                            <><Play className="w-4 h-4 mr-2" /> Resume Schedule</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          onClick={() => handleDelete(schedule.id)}
                        >
                          Delete Schedule
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
