
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AIReviewBadgeProps {
  score?: number;
  recommendation?: string;
  summary?: string;
}

export default function AIReviewBadge({ score, recommendation, summary }: AIReviewBadgeProps) {
  if (!score || !recommendation) {
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="w-3 h-3" />
        Pending Review
      </Badge>
    );
  }

  const getVariant = () => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "outline";
  };

  const getIcon = () => {
    if (score >= 80) return <CheckCircle2 className="w-3 h-3" />;
    if (score >= 60) return <Sparkles className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={getVariant()} className="gap-1 cursor-help">
            {getIcon()}
            AI Score: {score}/100
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="font-semibold mb-1">AI Assessment</p>
          <p className="text-sm">{summary}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
