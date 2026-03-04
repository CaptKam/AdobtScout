import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, dateFnsLocalizer, Views, type View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  Clock,
  Ban,
  CheckCircle2,
  Syringe,
  ClipboardList,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import GoogleTasksPanel from "@/components/google-tasks-panel";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: "availability" | "blocked" | "meetgreet" | "task" | "vaccine";
  color: string;
  allDay?: boolean;
  dogName?: string;
  adopterName?: string;
  priority?: string;
  taskType?: string;
  slotDuration?: number;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: typeof CalendarIcon }> = {
  availability: { label: "Availability", icon: CheckCircle2 },
  blocked: { label: "Blocked", icon: Ban },
  meetgreet: { label: "Meet & Greet", icon: Users },
  task: { label: "Task", icon: ClipboardList },
  vaccine: { label: "Vaccine Due", icon: Syringe },
};

export default function ShelterCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>(Views.WEEK);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showTasksPanel, setShowTasksPanel] = useState(true);

  const startDate = useMemo(() => {
    const start = startOfMonth(subMonths(currentDate, 1));
    return start.toISOString();
  }, [currentDate]);

  const endDate = useMemo(() => {
    const end = endOfMonth(addMonths(currentDate, 1));
    return end.toISOString();
  }, [currentDate]);

  const { data: rawEvents = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/shelter/calendar?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`],
  });

  const events = useMemo(() => {
    return rawEvents.map((event: any) => ({
      ...event,
      start: new Date(event.start),
      end: new Date(event.end),
    })) as CalendarEvent[];
  }, [rawEvents]);

  const handleNavigate = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
  }, []);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
  }, []);

  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const isAvailability = event.type === "availability";
    return {
      style: {
        backgroundColor: isAvailability ? `${event.color}20` : event.color,
        borderColor: event.color,
        borderWidth: isAvailability ? "2px" : "1px",
        borderStyle: isAvailability ? "dashed" : "solid",
        color: isAvailability ? event.color : "#fff",
        borderRadius: "4px",
        padding: "2px 4px",
        fontSize: "12px",
      },
    };
  }, []);

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {
      availability: 0,
      blocked: 0,
      meetgreet: 0,
      task: 0,
      vaccine: 0,
    };
    events.forEach((e) => {
      if (counts[e.type] !== undefined) counts[e.type]++;
    });
    return counts;
  }, [events]);

  return (
    
      <div className="flex h-full" data-testid="page-shelter-calendar">
        <div className={cn("flex-1 p-4 md:p-6 space-y-4 overflow-auto", showTasksPanel && "lg:pr-0")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">
              Calendar
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              View your schedule, meet & greets, and tasks
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth} data-testid="button-prev-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToToday} data-testid="button-today">
              <CalendarIcon className="w-4 h-4 mr-2" />
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth} data-testid="button-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant={showTasksPanel ? "default" : "outline"}
              size="icon"
              onClick={() => setShowTasksPanel(!showTasksPanel)}
              data-testid="button-toggle-tasks-panel"
              className="hidden lg:flex"
            >
              {showTasksPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  data-testid="button-mobile-tasks"
                  className="lg:hidden"
                >
                  <ClipboardList className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0">
                <GoogleTasksPanel
                  selectedDate={currentDate}
                  onDateSelect={(date) => setCurrentDate(date)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
            <CheckCircle2 className="w-3 h-3" />
            Availability ({eventCounts.availability})
          </Badge>
          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
            <Users className="w-3 h-3" />
            Meet & Greets ({eventCounts.meetgreet})
          </Badge>
          <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
            <Ban className="w-3 h-3" />
            Blocked ({eventCounts.blocked})
          </Badge>
          <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
            <ClipboardList className="w-3 h-3" />
            Tasks ({eventCounts.task})
          </Badge>
          <Badge variant="outline" className="gap-1 bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-400 dark:border-cyan-800">
            <Syringe className="w-3 h-3" />
            Vaccines ({eventCounts.vaccine})
          </Badge>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="h-[600px] shelter-calendar" data-testid="calendar-container">
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  date={currentDate}
                  onNavigate={handleNavigate}
                  view={view}
                  onView={handleViewChange}
                  views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                  eventPropGetter={eventStyleGetter}
                  onSelectEvent={handleSelectEvent}
                  toolbar={true}
                  popup
                  selectable={false}
                  className="rounded-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Upcoming Meet & Greets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events
                .filter((e) => e.type === "meetgreet" && e.start >= new Date())
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .slice(0, 3)
                .map((event) => (
                  <div
                    key={event.id}
                    className="py-2 border-b last:border-0 cursor-pointer hover-elevate rounded-md px-2 -mx-2"
                    onClick={() => setSelectedEvent(event)}
                    data-testid={`upcoming-meetgreet-${event.id}`}
                  >
                    <div className="font-medium text-sm">{event.dogName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(event.start, "EEE, MMM d 'at' h:mm a")}
                    </div>
                    {event.adopterName && (
                      <div className="text-xs text-muted-foreground">
                        with {event.adopterName}
                      </div>
                    )}
                  </div>
                ))}
              {events.filter((e) => e.type === "meetgreet" && e.start >= new Date()).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming meet & greets
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-500" />
                Upcoming Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events
                .filter((e) => e.type === "task" && e.start >= new Date())
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .slice(0, 3)
                .map((event) => (
                  <div
                    key={event.id}
                    className="py-2 border-b last:border-0 cursor-pointer hover-elevate rounded-md px-2 -mx-2"
                    onClick={() => setSelectedEvent(event)}
                    data-testid={`upcoming-task-${event.id}`}
                  >
                    <div className="font-medium text-sm flex items-center gap-2">
                      {event.title}
                      {event.priority === "urgent" && (
                        <Badge variant="destructive" className="text-xs h-5">Urgent</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(event.start, "EEE, MMM d")}
                    </div>
                  </div>
                ))}
              {events.filter((e) => e.type === "task" && e.start >= new Date()).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No upcoming tasks
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Syringe className="w-4 h-4 text-cyan-500" />
                Vaccines Due
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events
                .filter((e) => e.type === "vaccine")
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .slice(0, 3)
                .map((event) => (
                  <div
                    key={event.id}
                    className="py-2 border-b last:border-0 cursor-pointer hover-elevate rounded-md px-2 -mx-2"
                    onClick={() => setSelectedEvent(event)}
                    data-testid={`upcoming-vaccine-${event.id}`}
                  >
                    <div className="font-medium text-sm">{event.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(event.start, "EEE, MMM d")}
                    </div>
                  </div>
                ))}
              {events.filter((e) => e.type === "vaccine").length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No vaccines due
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-500" />
                Blocked Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {events
                .filter((e) => e.type === "blocked" && e.start >= new Date())
                .sort((a, b) => a.start.getTime() - b.start.getTime())
                .slice(0, 3)
                .map((event) => (
                  <div
                    key={event.id}
                    className="py-2 border-b last:border-0"
                    data-testid={`blocked-date-${event.id}`}
                  >
                    <div className="font-medium text-sm">{event.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(event.start, "EEE, MMM d")}
                      {!event.allDay && ` at ${format(event.start, "h:mm a")}`}
                    </div>
                  </div>
                ))}
              {events.filter((e) => e.type === "blocked" && e.start >= new Date()).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No blocked dates
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

        {showTasksPanel && (
          <div className="hidden lg:block w-80 border-l bg-background shrink-0">
            <GoogleTasksPanel
              selectedDate={currentDate}
              onDateSelect={(date) => setCurrentDate(date)}
            />
          </div>
        )}
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent data-testid="dialog-event-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEvent && EVENT_TYPE_LABELS[selectedEvent.type] && (
                <>
                  {(() => {
                    const Icon = EVENT_TYPE_LABELS[selectedEvent.type].icon;
                    return <Icon className="w-5 h-5" style={{ color: selectedEvent.color }} />;
                  })()}
                  {EVENT_TYPE_LABELS[selectedEvent.type].label}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.title}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Date</div>
                  <div className="text-sm">
                    {format(selectedEvent.start, "EEEE, MMMM d, yyyy")}
                  </div>
                </div>
                {!selectedEvent.allDay && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Time</div>
                    <div className="text-sm">
                      {format(selectedEvent.start, "h:mm a")} - {format(selectedEvent.end, "h:mm a")}
                    </div>
                  </div>
                )}
              </div>
              
              {selectedEvent.type === "meetgreet" && (
                <>
                  {selectedEvent.dogName && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Pet</div>
                      <div className="text-sm">{selectedEvent.dogName}</div>
                    </div>
                  )}
                  {selectedEvent.adopterName && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Adopter</div>
                      <div className="text-sm">{selectedEvent.adopterName}</div>
                    </div>
                  )}
                </>
              )}

              {selectedEvent.type === "task" && selectedEvent.priority && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Priority</div>
                  <Badge 
                    variant={selectedEvent.priority === "urgent" ? "destructive" : "secondary"}
                    className="mt-1"
                  >
                    {selectedEvent.priority}
                  </Badge>
                </div>
              )}

              {selectedEvent.type === "availability" && selectedEvent.slotDuration && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Slot Duration</div>
                  <div className="text-sm">{selectedEvent.slotDuration} minutes</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .shelter-calendar .rbc-calendar {
          font-family: inherit;
        }
        .shelter-calendar .rbc-header {
          padding: 8px;
          font-weight: 500;
          border-bottom: 1px solid hsl(var(--border));
        }
        .shelter-calendar .rbc-today {
          background-color: hsl(var(--primary) / 0.05);
        }
        .shelter-calendar .rbc-off-range-bg {
          background-color: hsl(var(--muted) / 0.3);
        }
        .shelter-calendar .rbc-event {
          border-radius: 4px;
        }
        .shelter-calendar .rbc-event:focus {
          outline: 2px solid hsl(var(--ring));
          outline-offset: 2px;
        }
        .shelter-calendar .rbc-toolbar {
          padding: 12px 16px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .shelter-calendar .rbc-toolbar button {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 14px;
        }
        .shelter-calendar .rbc-toolbar button:hover {
          background: hsl(var(--muted));
        }
        .shelter-calendar .rbc-toolbar button.rbc-active {
          background: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-color: hsl(var(--primary));
        }
        .shelter-calendar .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.3);
        }
        .shelter-calendar .rbc-timeslot-group {
          min-height: 50px;
        }
        .shelter-calendar .rbc-time-header-content {
          border-left: 1px solid hsl(var(--border));
        }
        .shelter-calendar .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid hsl(var(--border) / 0.2);
        }
        .shelter-calendar .rbc-current-time-indicator {
          background-color: hsl(var(--primary));
        }
        .shelter-calendar .rbc-month-view {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
        }
        .shelter-calendar .rbc-month-row {
          border-bottom: 1px solid hsl(var(--border));
        }
        .shelter-calendar .rbc-date-cell {
          padding: 4px 8px;
          text-align: right;
        }
        .shelter-calendar .rbc-date-cell.rbc-now {
          font-weight: 700;
        }
        .shelter-calendar .rbc-show-more {
          color: hsl(var(--primary));
          font-size: 12px;
          margin-top: 2px;
        }
        .shelter-calendar .rbc-agenda-view table.rbc-agenda-table {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
        }
        .shelter-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr > td + td {
          border-left: 1px solid hsl(var(--border));
        }
        .shelter-calendar .rbc-agenda-view table.rbc-agenda-table tbody > tr + tr {
          border-top: 1px solid hsl(var(--border));
        }
        .dark .shelter-calendar .rbc-toolbar button {
          background: hsl(var(--background));
          border-color: hsl(var(--border));
          color: hsl(var(--foreground));
        }
        .dark .shelter-calendar .rbc-toolbar button:hover {
          background: hsl(var(--muted));
        }
        .dark .shelter-calendar .rbc-header {
          background: hsl(var(--muted) / 0.3);
        }
      `}</style>
    
  );
}
