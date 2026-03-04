import { useState } from "react";
import { useLocation } from "wouter";
import { 
  Plus, X, Dog, ClipboardList, Stethoscope, AlertTriangle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const QUICK_ACTIONS = [
  { 
    id: "add-pet",
    label: "Add Pet", 
    icon: Dog, 
    href: "/shelter/intake",
    color: "bg-blue-500 hover:bg-blue-600 text-white"
  },
  { 
    id: "add-task",
    label: "Create Task", 
    icon: ClipboardList, 
    href: "/shelter/tasks",
    color: "bg-orange-500 hover:bg-orange-600 text-white"
  },
  { 
    id: "add-medical",
    label: "Log Medical", 
    icon: Stethoscope, 
    href: "/shelter/medical",
    color: "bg-purple-500 hover:bg-purple-600 text-white"
  },
  { 
    id: "view-urgent",
    label: "Urgent Items", 
    icon: AlertTriangle, 
    href: "/shelter/pipeline",
    color: "bg-red-500 hover:bg-red-600 text-white"
  },
];

export function ShelterQuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleActionClick = (href: string) => {
    setLocation(href);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-[calc(1.5rem+25px)] right-6 z-50 flex flex-col-reverse items-end gap-2">
      {isOpen && (
        <div className="flex flex-col-reverse gap-2 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {QUICK_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    className={`h-12 w-12 rounded-full shadow-lg ${action.color} animate-in fade-in slide-in-from-bottom-2`}
                    style={{ animationDelay: `${index * 50}ms` }}
                    onClick={() => handleActionClick(action.href)}
                    data-testid={`fab-${action.id}`}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-medium">
                  {action.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      )}
      
      <Button
        size="icon"
        className={`h-14 w-14 rounded-full shadow-xl transition-all duration-200 ${
          isOpen 
            ? "bg-muted-foreground hover:bg-muted-foreground/80 rotate-45" 
            : "bg-primary hover:bg-primary/90"
        }`}
        onClick={() => setIsOpen(!isOpen)}
        data-testid="fab-toggle"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Plus className="w-6 h-6" />
        )}
      </Button>
    </div>
  );
}
