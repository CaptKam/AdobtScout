import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon, RotateCcw, Search, Home, Heart, HeartHandshake, AlertTriangle, MapPin, Users } from 'lucide-react';
import { LOADING_STATE_STYLES, EMPTY_STATE_STYLES, MODE_COLORS, type UserMode } from '@/lib/design-tokens';

interface StateDisplayProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'outline';
  };
  className?: string;
}

const MODE_ICONS: Record<UserMode, LucideIcon> = {
  adopt: Heart,
  foster: Home,
  rehome: HeartHandshake,
};

export function LoadingState({ 
  icon: Icon, 
  title, 
  description,
  mode,
  className,
}: StateDisplayProps & { mode?: UserMode }) {
  const DisplayIcon = Icon || (mode ? MODE_ICONS[mode] : Heart);
  const modeColors = mode ? MODE_COLORS[mode] : null;
  
  return (
    <div className={cn(LOADING_STATE_STYLES.container, className)}>
      <div className={LOADING_STATE_STYLES.content}>
        <div className="relative">
          <div className={cn(
            LOADING_STATE_STYLES.iconContainer,
            modeColors ? `${modeColors.bgMuted}` : ''
          )}>
            <DisplayIcon className={cn(
              LOADING_STATE_STYLES.icon,
              modeColors ? modeColors.text : ''
            )} />
          </div>
        </div>
        <div>
          <h2 className={LOADING_STATE_STYLES.title}>{title}</h2>
          {description && (
            <p className={LOADING_STATE_STYLES.description} style={{ animationDelay: '0.1s' }}>
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ 
  icon: Icon,
  title, 
  description,
  action,
  secondaryAction,
  mode,
  className,
}: StateDisplayProps & { mode?: UserMode }) {
  const DisplayIcon = Icon || (mode ? MODE_ICONS[mode] : Search);
  const modeColors = mode ? MODE_COLORS[mode] : null;
  
  return (
    <div className={cn(EMPTY_STATE_STYLES.container, className)}>
      <div className={EMPTY_STATE_STYLES.content}>
        <div className="flex justify-center">
          <div className={cn(
            EMPTY_STATE_STYLES.iconContainer, 
            'group hover-elevate',
            modeColors ? modeColors.bgMuted : ''
          )}>
            <DisplayIcon className={cn(
              EMPTY_STATE_STYLES.icon, 
              'group-hover:scale-110 transition-transform',
              modeColors ? modeColors.text : ''
            )} />
          </div>
        </div>
        <div>
          <h2 className={EMPTY_STATE_STYLES.title}>{title}</h2>
          {description && (
            <p className={EMPTY_STATE_STYLES.description}>{description}</p>
          )}
        </div>
        {(action || secondaryAction) && (
          <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
            {action && (
              <Button 
                onClick={action.onClick}
                variant={action.variant || 'default'}
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button 
                onClick={secondaryAction.onClick}
                variant={secondaryAction.variant || 'outline'}
                className="btn-premium text-lg px-8 py-6"
                size="lg"
              >
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ErrorState({ 
  icon: Icon = AlertTriangle,
  title = 'Something went wrong', 
  description = "We're having trouble loading this content. Please try again.",
  action,
  className,
}: StateDisplayProps) {
  return (
    <div className={cn(EMPTY_STATE_STYLES.container, className)}>
      <div className={EMPTY_STATE_STYLES.content}>
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gradient-to-br from-destructive/20 to-destructive/5 rounded-2xl flex items-center justify-center">
            <Icon className="w-12 h-12 text-destructive/50" />
          </div>
        </div>
        <div>
          <h2 className={EMPTY_STATE_STYLES.title}>{title}</h2>
          <p className={EMPTY_STATE_STYLES.description}>{description}</p>
        </div>
        {action && (
          <Button 
            onClick={action.onClick}
            className="btn-premium text-lg px-8 py-6"
            size="lg"
            data-testid="button-retry"
          >
            <RotateCcw className="w-5 h-5 mr-3" />
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AllViewedState({
  mode,
  onReset,
  onViewMap,
  className,
}: {
  mode: UserMode;
  onReset?: () => void;
  onViewMap?: () => void;
  className?: string;
}) {
  const Icon = MODE_ICONS[mode];
  const modeColors = MODE_COLORS[mode];
  const titles: Record<UserMode, string> = {
    adopt: "You've seen all available pets!",
    foster: "You've seen all pets needing foster!",
    rehome: "You've seen all foster volunteers!",
  };
  const descriptions: Record<UserMode, string> = {
    adopt: 'Check back later for new pets looking for forever homes.',
    foster: 'Check back later for more pets who need foster care.',
    rehome: 'Check back later for more foster volunteers in your area.',
  };
  
  return (
    <div className={cn(EMPTY_STATE_STYLES.container, className)}>
      <div className={EMPTY_STATE_STYLES.content}>
        <div className="flex justify-center">
          <div className={cn(EMPTY_STATE_STYLES.iconContainer, modeColors.bgMuted)}>
            <Icon className={cn(EMPTY_STATE_STYLES.icon, 'animate-pulse', modeColors.text)} />
          </div>
        </div>
        <div>
          <h2 className={EMPTY_STATE_STYLES.title}>{titles[mode]}</h2>
          <p className={EMPTY_STATE_STYLES.description}>{descriptions[mode]}</p>
        </div>
        <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
          {onReset && (
            <Button 
              onClick={onReset}
              variant="outline"
              className="btn-premium text-lg px-8 py-6"
              size="lg"
              data-testid="button-reset"
            >
              <RotateCcw className="w-5 h-5 mr-3" />
              Start Over
            </Button>
          )}
          {onViewMap && (
            <Button 
              onClick={onViewMap}
              variant="default"
              className="btn-premium text-lg px-8 py-6"
              size="lg"
              data-testid="button-view-map"
            >
              <MapPin className="w-5 h-5 mr-3" />
              View Map
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function NoResultsState({
  mode,
  showUrgentOnly,
  onClearFilter,
  onExpandSearch,
  className,
}: {
  mode: UserMode;
  showUrgentOnly?: boolean;
  onClearFilter?: () => void;
  onExpandSearch?: () => void;
  className?: string;
}) {
  const Icon = MODE_ICONS[mode];
  const modeColors = MODE_COLORS[mode];
  
  const titles: Record<UserMode, { urgent: string; all: string }> = {
    adopt: {
      urgent: 'No urgent pets in your area',
      all: 'No pets available right now',
    },
    foster: {
      urgent: 'No urgent foster needs',
      all: 'No pets need foster right now',
    },
    rehome: {
      urgent: 'No urgent foster volunteers',
      all: 'No foster volunteers found',
    },
  };
  
  const descriptions: Record<UserMode, { urgent: string; all: string }> = {
    adopt: {
      urgent: "Great news! There are no urgent cases at the moment.",
      all: 'Check back soon - new pets are added regularly.',
    },
    foster: {
      urgent: "Great news! There are no urgent foster requests at the moment.",
      all: 'Check back soon - pet owners may need temporary foster help at any time.',
    },
    rehome: {
      urgent: "No urgent foster volunteers are available right now.",
      all: "We couldn't find any foster volunteers in your area. Try expanding your search radius.",
    },
  };
  
  return (
    <div className={cn(EMPTY_STATE_STYLES.container, className)}>
      <div className={EMPTY_STATE_STYLES.content}>
        <div className="flex justify-center">
          <div className={cn(EMPTY_STATE_STYLES.iconContainer, 'group hover-elevate', modeColors.bgMuted)}>
            <Icon className={cn(EMPTY_STATE_STYLES.icon, 'group-hover:scale-110 transition-transform', modeColors.text)} />
          </div>
        </div>
        <div>
          <h2 className={EMPTY_STATE_STYLES.title}>
            {showUrgentOnly ? titles[mode].urgent : titles[mode].all}
          </h2>
          <p className={EMPTY_STATE_STYLES.description}>
            {showUrgentOnly ? descriptions[mode].urgent : descriptions[mode].all}
          </p>
        </div>
        <div className="flex gap-4 justify-center flex-col sm:flex-row pt-4">
          {showUrgentOnly && onClearFilter && (
            <Button 
              onClick={onClearFilter}
              className="btn-premium text-lg px-8 py-6"
              size="lg"
              data-testid="button-show-all"
            >
              Show All
            </Button>
          )}
          {onExpandSearch && (
            <Button 
              onClick={onExpandSearch}
              variant={showUrgentOnly ? 'outline' : 'default'}
              className="btn-premium text-lg px-8 py-6"
              size="lg"
              data-testid="button-expand-search"
            >
              Expand Search
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
