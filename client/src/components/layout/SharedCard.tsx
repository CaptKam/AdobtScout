import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRoleSwitch } from "@/lib/role-switch-engine";
import { MODE_COLORS, type UserMode } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

interface SharedCardProps {
  children: React.ReactNode;
  className?: string;
  mode?: UserMode;
  variant?: 'default' | 'outlined' | 'elevated';
  showModeAccent?: boolean;
  onClick?: () => void;
  testId?: string;
}

export function SharedCard({ 
  children, 
  className = "",
  mode,
  variant = 'default',
  showModeAccent = false,
  onClick,
  testId
}: SharedCardProps) {
  const { currentMode } = useRoleSwitch();
  const activeMode = mode || currentMode;
  const modeColors = MODE_COLORS[activeMode];

  const variantClasses = {
    default: '',
    outlined: 'border-2',
    elevated: 'shadow-lg hover:shadow-xl transition-shadow',
  };

  return (
    <Card 
      className={cn(
        variantClasses[variant],
        showModeAccent && `border-2 ${modeColors.border}`,
        onClick && 'cursor-pointer hover-elevate',
        className
      )}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
    </Card>
  );
}

interface SharedCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  mode?: UserMode;
  badge?: string;
}

export function SharedCardHeader({ 
  children, 
  className = "",
  mode,
  badge
}: SharedCardHeaderProps) {
  const { currentMode } = useRoleSwitch();
  const activeMode = mode || currentMode;
  const modeColors = MODE_COLORS[activeMode];

  return (
    <CardHeader className={cn("flex flex-row items-center justify-between gap-2", className)}>
      {children}
      {badge && (
        <Badge 
          variant="secondary" 
          className={`${modeColors.bgMuted} ${modeColors.text}`}
        >
          {badge}
        </Badge>
      )}
    </CardHeader>
  );
}

interface SharedCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function SharedCardContent({ children, className = "" }: SharedCardContentProps) {
  return (
    <CardContent className={className}>
      {children}
    </CardContent>
  );
}

interface SharedCardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SharedCardFooter({ children, className = "" }: SharedCardFooterProps) {
  return (
    <CardFooter className={cn("flex items-center justify-between gap-2", className)}>
      {children}
    </CardFooter>
  );
}
