import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Dog,
  ClipboardList,
  Calendar,
  Inbox,
  CheckCircle2,
  Stethoscope,
  ListTodo,
  Users,
  MessageSquare,
  FileText,
  Plus,
} from "lucide-react";

type EmptyStateVariant =
  | "dogs"
  | "tasks"
  | "applications"
  | "calendar"
  | "inbox"
  | "medical"
  | "staff"
  | "messages"
  | "documents"
  | "generic";

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}> = {
  dogs: {
    icon: <Dog className="w-8 h-8" />,
    title: "No pets yet",
    description: "Start by adding your first pet to the system. The intake process takes just a few minutes.",
    actionLabel: "Add First Pet",
    actionHref: "/shelter/intake",
  },
  tasks: {
    icon: <CheckCircle2 className="w-8 h-8" />,
    title: "You're all caught up",
    description: "No pending tasks right now. Great job staying on top of things.",
  },
  applications: {
    icon: <ClipboardList className="w-8 h-8" />,
    title: "No applications yet",
    description: "When adopters apply for your pets, their applications will appear here for review.",
  },
  calendar: {
    icon: <Calendar className="w-8 h-8" />,
    title: "Calendar is clear",
    description: "No events scheduled. Add availability windows to let adopters book meet & greets.",
    actionLabel: "Set Availability",
    actionHref: "/shelter/calendar",
  },
  inbox: {
    icon: <CheckCircle2 className="w-8 h-8" />,
    title: "You're all caught up",
    description: "No unread messages or pending decisions.",
  },
  medical: {
    icon: <Stethoscope className="w-8 h-8" />,
    title: "No medical records",
    description: "Medical history, vaccinations, and treatment plans will appear here.",
  },
  staff: {
    icon: <Users className="w-8 h-8" />,
    title: "No staff members",
    description: "Invite your team to collaborate on pet management and applications.",
    actionLabel: "Invite Staff",
    actionHref: "/shelter/staff",
  },
  messages: {
    icon: <MessageSquare className="w-8 h-8" />,
    title: "No messages",
    description: "Start a conversation with adopters or foster families.",
  },
  documents: {
    icon: <FileText className="w-8 h-8" />,
    title: "No documents",
    description: "Upload adoption contracts, medical records, and other important files.",
  },
  generic: {
    icon: <CheckCircle2 className="w-8 h-8" />,
    title: "Nothing here yet",
    description: "This section is empty. Check back later or create something new.",
  },
};

export function EmptyState({
  variant = "generic",
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  
  const displayTitle = title || config.title;
  const displayDescription = description || config.description;
  const displayActionLabel = actionLabel || config.actionLabel;
  const displayActionHref = actionHref || config.actionHref;

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in-scale",
        className
      )}
      data-testid={`empty-state-${variant}`}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-muted">
        <div className="text-muted-foreground">
          {config.icon}
        </div>
      </div>
      
      <h3 className="text-lg font-semibold mb-2">{displayTitle}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{displayDescription}</p>
      
      {(displayActionLabel && displayActionHref) && (
        <Button asChild data-testid={`button-empty-state-action-${variant}`}>
          <Link href={displayActionHref}>
            <Plus className="w-4 h-4 mr-2" />
            {displayActionLabel}
          </Link>
        </Button>
      )}
      
      {(displayActionLabel && onAction && !displayActionHref) && (
        <Button onClick={onAction} data-testid={`button-empty-state-action-${variant}`}>
          <Plus className="w-4 h-4 mr-2" />
          {displayActionLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyStateInline({
  variant = "generic",
  title,
  description,
  className,
}: Omit<EmptyStateProps, "actionLabel" | "actionHref" | "onAction">) {
  const config = variantConfig[variant];
  
  return (
    <div 
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg bg-muted/50 text-left animate-fade-in-scale",
        className
      )}
      data-testid={`empty-state-inline-${variant}`}
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-muted">
        <div className="text-muted-foreground scale-75">
          {config.icon}
        </div>
      </div>
      
      <div>
        <h4 className="font-medium text-sm">{title || config.title}</h4>
        <p className="text-xs text-muted-foreground">{description || config.description}</p>
      </div>
    </div>
  );
}
