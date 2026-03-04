import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface KpiMetric {
  label: string;
  value: number | string;
  previousValue?: number;
  format?: "number" | "percent" | "currency";
  icon?: React.ReactNode;
  accentColor?: "default" | "success" | "warning" | "danger";
}

interface KpiRibbonProps {
  metrics: KpiMetric[];
  isLoading?: boolean;
  className?: string;
}

function formatValue(value: number | string, format?: string): string {
  if (typeof value === "string") return value;
  switch (format) {
    case "percent":
      return `${value}%`;
    case "currency":
      return `$${value.toLocaleString()}`;
    default:
      return value.toLocaleString();
  }
}

function calculateTrend(current: number | string, previous?: number): { direction: "up" | "down" | "flat"; percent: number } {
  if (typeof current === "string" || previous === undefined || previous === 0) {
    return { direction: "flat", percent: 0 };
  }
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 1) return { direction: "flat", percent: 0 };
  return {
    direction: change > 0 ? "up" : "down",
    percent: Math.abs(Math.round(change)),
  };
}

function KpiCard({ metric, isLoading }: { metric: KpiMetric; isLoading?: boolean }) {
  const trend = calculateTrend(metric.value, metric.previousValue);
  
  // Icon gradient classes based on accent - uses CSS .kpi-card-icon variants
  const iconVariants = {
    default: "",
    success: "success",
    warning: "warning",
    danger: "danger",
  };

  if (isLoading) {
    return (
      <div className="kpi-card flex-1 min-w-[140px]">
        <Skeleton className="h-3 w-16 mb-3" />
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-4 w-12" />
      </div>
    );
  }

  return (
    <div className="kpi-card flex-1 min-w-[140px]" data-testid={`kpi-card-${metric.label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {metric.icon && (
            <span className={cn("kpi-card-icon", iconVariants[metric.accentColor || "default"])}>
              {metric.icon}
            </span>
          )}
        </div>
        {metric.previousValue !== undefined && trend.direction !== "flat" && (
          <span className={cn("kpi-card-trend", trend.direction === "up" ? "positive" : "negative")}>
            {trend.direction === "up" ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {trend.percent}%
          </span>
        )}
      </div>
      
      <div className="kpi-card-value">
        {formatValue(metric.value, metric.format)}
      </div>
      
      <div className="kpi-card-label">
        {metric.label}
      </div>
    </div>
  );
}

export function KpiRibbon({ metrics, isLoading, className }: KpiRibbonProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)} data-testid="kpi-ribbon">
      {metrics.map((metric, index) => (
        <KpiCard 
          key={metric.label} 
          metric={metric} 
          isLoading={isLoading}
        />
      ))}
    </div>
  );
}

export function KpiRibbonSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-wrap gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`kpi-card flex-1 min-w-[140px] animate-fade-in-scale stagger-${i + 1}`} style={{ animationFillMode: 'both' }}>
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
