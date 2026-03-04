import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Home, HeartHandshake, Dog, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserProfile } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ModeBridgeCTAProps {
  currentMode: 'adopt' | 'foster' | 'rehome';
  profile: UserProfile;
}

export function ModeBridgeCTA({ currentMode, profile }: ModeBridgeCTAProps) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);
  
  const switchModeMutation = useMutation({
    mutationFn: async (mode: 'adopt' | 'foster' | 'rehome') => {
      await apiRequest("PATCH", "/api/profile", { mode });
    },
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs/discover"] });
      toast({
        title: "Mode Changed",
        description: `You are now in ${mode === 'adopt' ? 'adoption' : mode === 'foster' ? 'fostering' : 'rehoming'} mode.`,
      });
    },
  });

  if (dismissed) return null;

  const suggestions: Record<'adopt' | 'foster' | 'rehome', { primary: { mode: 'adopt' | 'foster'; title: string; description: string; icon: any; buttonText: string; modeColor: 'adopt' | 'foster' } }> = {
    adopt: {
      primary: {
        mode: 'foster',
        title: "Want to help dogs in need?",
        description: "Switch to Foster mode to offer temporary care for dogs waiting for their forever home.",
        icon: Home,
        buttonText: "Start Fostering",
        modeColor: "foster",
      },
    },
    foster: {
      primary: {
        mode: 'adopt',
        title: "Ready for a permanent companion?",
        description: "Switch to Adopt mode to find your perfect forever match.",
        icon: Heart,
        buttonText: "Find a Dog to Adopt",
        modeColor: "adopt",
      },
    },
    rehome: {
      primary: {
        mode: 'adopt',
        title: "Looking to adopt a dog?",
        description: "Switch to Adopt mode to discover dogs available for permanent adoption.",
        icon: Heart,
        buttonText: "Browse Adoptable Dogs",
        modeColor: "adopt",
      },
    },
  };

  const primary = suggestions[currentMode].primary;
  const IconComponent = primary.icon;
  const isAdoptMode = primary.modeColor === 'adopt';

  return (
    <Card className={cn(
      "relative to-transparent",
      isAdoptMode 
        ? "border-[hsl(var(--mode-adopt-border)/0.2)] bg-gradient-to-r from-[hsl(var(--mode-adopt)/0.05)]"
        : "border-[hsl(var(--mode-foster-border)/0.2)] bg-gradient-to-r from-[hsl(var(--mode-foster)/0.05)]"
    )}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
        data-testid="button-dismiss-cta"
      >
        <X className="w-4 h-4" />
      </Button>
      <CardContent className="p-4 pr-10">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-full shrink-0",
            isAdoptMode ? "bg-[hsl(var(--mode-adopt)/0.1)]" : "bg-[hsl(var(--mode-foster)/0.1)]"
          )}>
            <IconComponent className={cn(
              "w-5 h-5",
              isAdoptMode ? "text-[hsl(var(--mode-adopt))]" : "text-[hsl(var(--mode-foster))]"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{primary.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{primary.description}</p>
            <Button
              size="sm"
              variant={isAdoptMode ? 'default' : 'outline'}
              className={cn(
                "mt-3",
                !isAdoptMode && "border-[hsl(var(--mode-foster))] text-[hsl(var(--mode-foster))] hover:bg-[hsl(var(--mode-foster)/0.1)]"
              )}
              onClick={() => switchModeMutation.mutate(primary.mode)}
              disabled={switchModeMutation.isPending}
              data-testid={`button-switch-to-${primary.mode}`}
            >
              {primary.buttonText}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateBridgeProps {
  currentMode: 'adopt' | 'foster' | 'rehome';
  message?: string;
}

export function EmptyStateBridge({ currentMode, message }: EmptyStateBridgeProps) {
  const { toast } = useToast();
  
  const switchModeMutation = useMutation({
    mutationFn: async (mode: 'adopt' | 'foster' | 'rehome') => {
      await apiRequest("PATCH", "/api/profile", { mode });
    },
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dogs"] });
      toast({
        title: "Mode Changed",
        description: `You are now in ${mode === 'adopt' ? 'adoption' : mode === 'foster' ? 'fostering' : 'rehoming'} mode.`,
      });
    },
  });

  const getAlternativeMode = () => {
    if (currentMode === 'adopt') return { mode: 'foster' as const, label: 'Foster dogs instead', icon: Home };
    if (currentMode === 'foster') return { mode: 'adopt' as const, label: 'Adopt a dog', icon: Heart };
    return { mode: 'adopt' as const, label: 'Adopt a dog', icon: Heart };
  };

  const alternative = getAlternativeMode();

  return (
    <div className="text-center space-y-4">
      {message && <p className="text-muted-foreground">{message}</p>}
      <Button
        variant="outline"
        onClick={() => switchModeMutation.mutate(alternative.mode)}
        disabled={switchModeMutation.isPending}
        data-testid={`button-empty-switch-${alternative.mode}`}
      >
        <alternative.icon className="w-4 h-4 mr-2" />
        {alternative.label}
      </Button>
    </div>
  );
}
