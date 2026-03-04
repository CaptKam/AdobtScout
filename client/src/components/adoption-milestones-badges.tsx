import { Badge } from "@/components/ui/badge";
import { Heart, Trophy, PartyPopper } from "lucide-react";

interface AdoptionMilestonesBadgesProps {
  milestones?: string[];
  currentStep?: string;
}

export function AdoptionMilestonesBadges({
  milestones = [],
  currentStep,
}: AdoptionMilestonesBadgesProps) {
  const getMilestoneDetails = (milestone: string) => {
    const details: Record<string, { label: string; icon: any; color: string }> = {
      first_swipe: {
        label: "First Swipe",
        icon: Heart,
        color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
      },
      shelter_visit_complete: {
        label: "Shelter Visit Complete",
        icon: Trophy,
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      },
      adoption_day: {
        label: "Adoption Day!",
        icon: PartyPopper,
        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      },
    };
    return details[milestone];
  };

  if (!milestones || milestones.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="adoption-milestones-badges">
      {milestones.map((milestone) => {
        const details = getMilestoneDetails(milestone);
        if (!details) return null;

        const IconComponent = details.icon;
        return (
          <Badge
            key={milestone}
            className={`${details.color} flex items-center gap-1.5 px-3 py-1.5 shadow-sm hover-elevate`}
            data-testid={`badge-milestone-${milestone}`}
          >
            <IconComponent className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{details.label}</span>
          </Badge>
        );
      })}
    </div>
  );
}
