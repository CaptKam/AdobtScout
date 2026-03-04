import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ShelterAvailability, ShelterBlockedDate } from "@shared/schema";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Bell,
  Shield,
  Palette,
  Save,
  Clock,
  CalendarDays,
  Plus,
  Trash2,
  CalendarOff,
} from "lucide-react";

interface ShelterSettings {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  website: string;
  description: string;
  operatingHours: string;
  timezone: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  adoptionFee: number;
  requireHomeVisit: boolean;
  requireReferences: boolean;
  autoApproveApplications: boolean;
}

const DEFAULT_SETTINGS: ShelterSettings = {
  name: "Happy Tails Rescue",
  email: "contact@happytails.org",
  phone: "(555) 123-4567",
  address: "123 Main Street",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
  website: "https://happytails.org",
  description: "A no-kill shelter dedicated to finding loving homes for dogs in need.",
  operatingHours: "Mon-Fri: 10am-6pm, Sat-Sun: 11am-5pm",
  timezone: "America/Los_Angeles",
  emailNotifications: true,
  smsNotifications: false,
  adoptionFee: 250,
  requireHomeVisit: true,
  requireReferences: true,
  autoApproveApplications: false,
};

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return [
    { value: `${hour}:00`, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:00 ${i < 12 ? 'AM' : 'PM'}` },
    { value: `${hour}:30`, label: `${i === 0 ? 12 : i > 12 ? i - 12 : i}:30 ${i < 12 ? 'AM' : 'PM'}` },
  ];
}).flat();

function AvailabilityTab() {
  const { toast } = useToast();
  const [newSlot, setNewSlot] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    slotDuration: 60
  });
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");

  const { data: availability = [], isLoading: loadingAvailability } = useQuery<ShelterAvailability[]>({
    queryKey: ["/api/shelter/availability"],
  });

  const { data: blockedDates = [], isLoading: loadingBlocked } = useQuery<ShelterBlockedDate[]>({
    queryKey: ["/api/shelter/blocked-dates"],
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: typeof newSlot) => {
      return apiRequest("POST", "/api/shelter/availability", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/availability"] });
      toast({ title: "Success", description: "Availability slot added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add slot", variant: "destructive" });
    }
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/shelter/availability/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/availability"] });
      toast({ title: "Success", description: "Slot removed" });
    }
  });

  const createBlockedDateMutation = useMutation({
    mutationFn: async (data: { blockedDate: Date; reason: string }) => {
      return apiRequest("POST", "/api/shelter/blocked-dates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/blocked-dates"] });
      setBlockDate(undefined);
      setBlockReason("");
      toast({ title: "Success", description: "Date blocked" });
    }
  });

  const deleteBlockedDateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/shelter/blocked-dates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/blocked-dates"] });
      toast({ title: "Success", description: "Blocked date removed" });
    }
  });

  const handleAddSlot = () => {
    if (newSlot.startTime >= newSlot.endTime) {
      toast({ title: "Error", description: "End time must be after start time", variant: "destructive" });
      return;
    }
    createSlotMutation.mutate(newSlot);
  };

  const handleBlockDate = () => {
    if (!blockDate) return;
    createBlockedDateMutation.mutate({ blockedDate: blockDate, reason: blockReason });
  };

  const getDayLabel = (day: number) => DAYS_OF_WEEK.find(d => d.value === day)?.label || "";

  const formatTime = (time: string) => {
    const [hour, min] = time.split(':').map(Number);
    const ampm = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            Weekly Availability
          </CardTitle>
          <CardDescription>Set your recurring weekly meet & greet times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-5 gap-3 items-end">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select
                value={newSlot.dayOfWeek.toString()}
                onValueChange={(v) => setNewSlot(s => ({ ...s, dayOfWeek: parseInt(v) }))}
              >
                <SelectTrigger data-testid="select-day">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK.map(day => (
                    <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select
                value={newSlot.startTime}
                onValueChange={(v) => setNewSlot(s => ({ ...s, startTime: v }))}
              >
                <SelectTrigger data-testid="select-start-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Select
                value={newSlot.endTime}
                onValueChange={(v) => setNewSlot(s => ({ ...s, endTime: v }))}
              >
                <SelectTrigger data-testid="select-end-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Slot Duration</Label>
              <Select
                value={newSlot.slotDuration.toString()}
                onValueChange={(v) => setNewSlot(s => ({ ...s, slotDuration: parseInt(v) }))}
              >
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAddSlot} 
              disabled={createSlotMutation.isPending}
              data-testid="button-add-slot"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Current Availability</Label>
            {loadingAvailability ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : availability.length === 0 ? (
              <p className="text-sm text-muted-foreground">No availability slots set. Add your first slot above.</p>
            ) : (
              <div className="space-y-2">
                {availability.map((slot) => (
                  <div 
                    key={slot.id} 
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`slot-${slot.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{getDayLabel(slot.dayOfWeek)}</Badge>
                      <span className="text-sm">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({slot.slotDuration} min slots)
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteSlotMutation.mutate(slot.id)}
                      disabled={deleteSlotMutation.isPending}
                      data-testid={`button-delete-slot-${slot.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarOff className="w-5 h-5" />
            Blocked Dates
          </CardTitle>
          <CardDescription>Block specific dates when you're unavailable (holidays, closures, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>Date to Block</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal" data-testid="button-select-block-date">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {blockDate ? format(blockDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={blockDate}
                    onSelect={setBlockDate}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 flex-1 min-w-[150px]">
              <Label>Reason (optional)</Label>
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Holiday"
                data-testid="input-block-reason"
              />
            </div>
            <Button
              onClick={handleBlockDate}
              disabled={!blockDate || createBlockedDateMutation.isPending}
              data-testid="button-block-date"
            >
              <Plus className="w-4 h-4 mr-2" />
              Block Date
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Blocked Dates</Label>
            {loadingBlocked ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : blockedDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dates blocked.</p>
            ) : (
              <div className="space-y-2">
                {blockedDates.map((blocked) => (
                  <div 
                    key={blocked.id} 
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`blocked-${blocked.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">
                        {format(new Date(blocked.blockedDate), "PPP")}
                      </Badge>
                      {blocked.reason && (
                        <span className="text-sm text-muted-foreground">{blocked.reason}</span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteBlockedDateMutation.mutate(blocked.id)}
                      disabled={deleteBlockedDateMutation.isPending}
                      data-testid={`button-delete-blocked-${blocked.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export default function ShelterSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ShelterSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      toast({
        title: "Settings Saved",
        description: "Your shelter settings have been updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof ShelterSettings>(
    key: K,
    value: ShelterSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-settings">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Settings</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage your shelter's configuration</p>
          </div>
          <Button onClick={handleSave} disabled={isSaving} data-testid="button-save-settings">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
            <TabsTrigger value="general" className="gap-2" data-testid="tab-general">
              <Building2 className="w-4 h-4 hidden sm:block" />
              General
            </TabsTrigger>
            <TabsTrigger value="availability" className="gap-2" data-testid="tab-availability">
              <CalendarDays className="w-4 h-4 hidden sm:block" />
              Availability
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2" data-testid="tab-notifications">
              <Bell className="w-4 h-4 hidden sm:block" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="adoptions" className="gap-2" data-testid="tab-adoptions">
              <Shield className="w-4 h-4 hidden sm:block" />
              Adoptions
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2" data-testid="tab-appearance">
              <Palette className="w-4 h-4 hidden sm:block" />
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Shelter Information
                </CardTitle>
                <CardDescription>Basic details about your organization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Shelter Name</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => updateSetting("name", e.target.value)}
                    data-testid="input-shelter-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={settings.description}
                    onChange={(e) => updateSetting("description", e.target.value)}
                    rows={3}
                    data-testid="input-description"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={settings.email}
                        onChange={(e) => updateSetting("email", e.target.value)}
                        className="pl-10"
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={settings.phone}
                        onChange={(e) => updateSetting("phone", e.target.value)}
                        className="pl-10"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="website"
                      value={settings.website}
                      onChange={(e) => updateSetting("website", e.target.value)}
                      className="pl-10"
                      data-testid="input-website"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
                <CardDescription>Your shelter's physical address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={settings.address}
                    onChange={(e) => updateSetting("address", e.target.value)}
                    data-testid="input-address"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={settings.city}
                      onChange={(e) => updateSetting("city", e.target.value)}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={settings.state}
                      onChange={(e) => updateSetting("state", e.target.value)}
                      data-testid="input-state"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 sm:col-span-1">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={settings.zipCode}
                      onChange={(e) => updateSetting("zipCode", e.target.value)}
                      data-testid="input-zipcode"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Hours & Timezone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="operatingHours">Operating Hours</Label>
                  <Input
                    id="operatingHours"
                    value={settings.operatingHours}
                    onChange={(e) => updateSetting("operatingHours", e.target.value)}
                    placeholder="Mon-Fri: 10am-6pm, Sat-Sun: 11am-5pm"
                    data-testid="input-hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => updateSetting("timezone", value)}
                  >
                    <SelectTrigger data-testid="select-timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="availability" className="space-y-6">
            <AvailabilityTab />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Control how you receive alerts and updates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive updates about applications and tasks via email
                    </p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="smsNotifications">SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get text alerts for urgent matters
                    </p>
                  </div>
                  <Switch
                    id="smsNotifications"
                    checked={settings.smsNotifications}
                    onCheckedChange={(checked) => updateSetting("smsNotifications", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adoptions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Adoption Requirements
                </CardTitle>
                <CardDescription>Configure your adoption process</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="adoptionFee">Standard Adoption Fee ($)</Label>
                  <Input
                    id="adoptionFee"
                    type="number"
                    value={settings.adoptionFee}
                    onChange={(e) => updateSetting("adoptionFee", Number(e.target.value))}
                    className="max-w-[200px]"
                    data-testid="input-adoption-fee"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireHomeVisit">Require Home Visit</Label>
                    <p className="text-sm text-muted-foreground">
                      Conduct a home visit before finalizing adoptions
                    </p>
                  </div>
                  <Switch
                    id="requireHomeVisit"
                    checked={settings.requireHomeVisit}
                    onCheckedChange={(checked) => updateSetting("requireHomeVisit", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="requireReferences">Require References</Label>
                    <p className="text-sm text-muted-foreground">
                      Ask applicants to provide personal references
                    </p>
                  </div>
                  <Switch
                    id="requireReferences"
                    checked={settings.requireReferences}
                    onCheckedChange={(checked) => updateSetting("requireReferences", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoApproveApplications">Auto-Approve Applications</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically approve applications that meet all criteria
                    </p>
                  </div>
                  <Switch
                    id="autoApproveApplications"
                    checked={settings.autoApproveApplications}
                    onCheckedChange={(checked) => updateSetting("autoApproveApplications", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding
                </CardTitle>
                <CardDescription>Customize your shelter's appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-2">Upload your shelter logo</p>
                  <Button variant="outline" size="sm">
                    Choose File
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Additional branding options coming soon
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    
  );
}
