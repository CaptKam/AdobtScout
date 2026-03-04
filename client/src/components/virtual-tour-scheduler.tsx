
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Video, Calendar as CalendarIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VirtualTourSchedulerProps {
  dogId: string;
  dogName: string;
  onScheduled?: () => void;
}

export default function VirtualTourScheduler({ dogId, dogName, onScheduled }: VirtualTourSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("10:00");
  const [notes, setNotes] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(true);
  const { toast } = useToast();

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error("Please select a date");
      
      const scheduledAt = new Date(selectedDate);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      scheduledAt.setHours(hours, minutes, 0, 0);

      return apiRequest("POST", "/api/virtual-tours", {
        dogId,
        scheduledAt: scheduledAt.toISOString(),
        notes,
        phoneNumber: smsOptIn && phoneNumber ? phoneNumber : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/virtual-tours"] });
      toast({
        title: "Virtual tour scheduled!",
        description: `Your virtual meet & greet with ${dogName} is confirmed.`,
      });
      onScheduled?.();
    },
    onError: () => {
      toast({
        title: "Failed to schedule tour",
        description: "Please try again or contact the shelter directly.",
        variant: "destructive",
      });
    },
  });

  const timeSlots = [
    "09:00", "10:00", "11:00", "12:00", 
    "13:00", "14:00", "15:00", "16:00", "17:00"
  ];

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold mb-3 block">Select Date</Label>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => date < new Date() || date.getDay() === 0}
          className="rounded-md border"
        />
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Select Time</Label>
        <div className="grid grid-cols-3 gap-2">
          {timeSlots.map((time) => (
            <Button
              key={time}
              variant={selectedTime === time ? "default" : "outline"}
              onClick={() => setSelectedTime(time)}
              className="w-full"
            >
              {time}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="phoneNumber" className="text-base font-semibold mb-3 block">
          Phone Number (Optional)
        </Label>
        <Input
          id="phoneNumber"
          type="tel"
          placeholder="+1 (555) 123-4567"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />
        <div className="flex items-center gap-2 mt-2">
          <input
            type="checkbox"
            id="smsOptIn"
            checked={smsOptIn}
            onChange={(e) => setSmsOptIn(e.target.checked)}
            className="rounded border-gray-300"
          />
          <Label htmlFor="smsOptIn" className="text-sm font-normal cursor-pointer">
            Send me SMS reminders for this virtual tour
          </Label>
        </div>
      </div>

      <div>
        <Label htmlFor="notes" className="text-base font-semibold mb-3 block">
          Questions or Notes (Optional)
        </Label>
        <Textarea
          id="notes"
          placeholder="Any specific questions you'd like to ask during the virtual tour?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
        />
      </div>

      <Button
        onClick={() => scheduleMutation.mutate()}
        disabled={!selectedDate || scheduleMutation.isPending}
        className="w-full"
        size="lg"
      >
        <Video className="w-5 h-5 mr-2" />
        {scheduleMutation.isPending ? "Scheduling..." : "Schedule Virtual Tour"}
      </Button>

      {selectedDate && (
        <p className="text-sm text-center text-muted-foreground">
          <CalendarIcon className="w-4 h-4 inline mr-1" />
          {format(selectedDate, "EEEE, MMMM d")} at {selectedTime}
        </p>
      )}
    </div>
  );
}
