import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Home, HeartHandshake, Check, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRoleSwitch, useModeSwitcher, type UserMode, MODE_CONFIGS } from '@/lib/role-switch-engine';
import { cn } from '@/lib/utils';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const MODE_ICONS = {
  adopt: Heart,
  foster: Home,
  rehome: HeartHandshake,
} as const;

interface ModeSwitcherProps {
  variant?: 'tabs' | 'dropdown' | 'compact';
  className?: string;
  showLabels?: boolean;
  onModeChange?: (mode: UserMode) => void;
}

export function ModeSwitcher({ 
  variant = 'tabs', 
  className,
  showLabels = true,
  onModeChange,
}: ModeSwitcherProps) {
  const { currentMode, isAuthenticated } = useRoleSwitch();
  const { switchMode, isLoading, canSwitchToRehome } = useModeSwitcher();
  const { toast } = useToast();
  const { data: featureFlags, isLoading: featuresLoading } = useFeatureFlags();
  
  // Filter available modes based on feature flags
  // Default to ALL modes while loading to prevent UI flickering
  const availableModes = useMemo((): UserMode[] => {
    // While loading, show all modes (default to enabled)
    if (featuresLoading || !featureFlags) {
      return ['adopt', 'foster', 'rehome'];
    }
    
    const enabledFeatures = featureFlags.enabledFeatures;
    const modes: UserMode[] = ['adopt'];
    
    if (enabledFeatures.includes('foster_mode')) {
      modes.push('foster');
    }
    if (enabledFeatures.includes('rehome_mode')) {
      modes.push('rehome');
    }
    
    return modes;
  }, [featureFlags, featuresLoading]);
  
  const [showRehomeDialog, setShowRehomeDialog] = useState(false);
  const [rehomeData, setRehomeData] = useState({
    phoneNumber: '',
    city: '',
    state: '',
    reasonForRehoming: '',
  });

  const handleModeSelect = useCallback(async (mode: UserMode) => {
    if (mode === currentMode) return;
    
    if (!isAuthenticated) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to switch modes.',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'rehome') {
      const { valid } = canSwitchToRehome();
      if (!valid) {
        setShowRehomeDialog(true);
        return;
      }
    }

    const success = await switchMode(mode);
    if (success) {
      toast({
        title: 'Mode Changed',
        description: `Switched to ${MODE_CONFIGS[mode].label} mode.`,
      });
      onModeChange?.(mode);
    }
  }, [currentMode, isAuthenticated, canSwitchToRehome, switchMode, toast, onModeChange]);

  const handleRehomeSubmit = useCallback(async () => {
    if (!rehomeData.phoneNumber || !rehomeData.city || !rehomeData.state || !rehomeData.reasonForRehoming) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    const success = await switchMode('rehome', { rehomeData });
    if (success) {
      setShowRehomeDialog(false);
      setRehomeData({ phoneNumber: '', city: '', state: '', reasonForRehoming: '' });
      toast({
        title: 'Mode Changed',
        description: 'Switched to Rehome mode. You can now list your dog.',
      });
      onModeChange?.('rehome');
    } else {
      toast({
        title: 'Error',
        description: 'Failed to switch to rehome mode. Please try again.',
        variant: 'destructive',
      });
    }
  }, [rehomeData, switchMode, toast, onModeChange]);

  if (variant === 'dropdown') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className={cn('gap-2', className)}
              disabled={isLoading}
              data-testid="mode-switcher-dropdown"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {(() => {
                    const Icon = MODE_ICONS[currentMode];
                    return <Icon className={cn('w-4 h-4', MODE_CONFIGS[currentMode].color)} />;
                  })()}
                  {showLabels && <span>{MODE_CONFIGS[currentMode].label}</span>}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {availableModes.map((mode) => {
              const Icon = MODE_ICONS[mode];
              const config = MODE_CONFIGS[mode];
              const isActive = mode === currentMode;

              return (
                <DropdownMenuItem
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className={cn(
                    'flex items-center gap-3 py-3 cursor-pointer',
                    isActive && 'bg-accent'
                  )}
                  data-testid={`mode-option-${mode}`}
                >
                  <div className={cn('p-1.5 rounded-md', config.bgColor)}>
                    <Icon className={cn('w-4 h-4', config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-muted-foreground">{config.description}</div>
                  </div>
                  {isActive && <Check className="w-4 h-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <RehomeDialog 
          open={showRehomeDialog}
          onOpenChange={setShowRehomeDialog}
          data={rehomeData}
          onDataChange={setRehomeData}
          onSubmit={handleRehomeSubmit}
          isLoading={isLoading}
        />
      </>
    );
  }

  if (variant === 'compact') {
    return (
      <>
        <div className={cn('flex items-center gap-1 p-1 bg-muted/50 rounded-full', className)}>
          {availableModes.map((mode) => {
            const Icon = MODE_ICONS[mode];
            const config = MODE_CONFIGS[mode];
            const isActive = mode === currentMode;

            return (
              <button
                key={mode}
                onClick={() => handleModeSelect(mode)}
                disabled={isLoading}
                className={cn(
                  'relative p-2 rounded-full transition-all duration-200',
                  isActive ? config.bgColor : 'hover:bg-muted',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
                title={config.label}
                data-testid={`mode-button-${mode}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mode-indicator-compact"
                    className="absolute inset-0 bg-background rounded-full shadow-sm"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <Icon className={cn(
                  'relative w-4 h-4 transition-colors',
                  isActive ? config.color : 'text-muted-foreground'
                )} />
              </button>
            );
          })}
        </div>

        <RehomeDialog 
          open={showRehomeDialog}
          onOpenChange={setShowRehomeDialog}
          data={rehomeData}
          onDataChange={setRehomeData}
          onSubmit={handleRehomeSubmit}
          isLoading={isLoading}
        />
      </>
    );
  }

  return (
    <>
      <div className={cn('flex items-center gap-0 p-1 bg-muted/30 rounded-xl w-full overflow-hidden', className)}>
        {availableModes.map((mode) => {
          const Icon = MODE_ICONS[mode];
          const config = MODE_CONFIGS[mode];
          const isActive = mode === currentMode;

          return (
            <button
              key={mode}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleModeSelect(mode);
              }}
              disabled={isLoading}
              className={cn(
                'relative flex-1 min-w-0 flex items-center justify-center gap-1 px-1.5 sm:px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
              )}
              data-testid={`mode-tab-${mode}`}
            >
              {isActive && (
                <motion.div
                  layoutId="mode-indicator-tabs"
                  className={cn('absolute inset-0 rounded-lg shadow-sm', config.bgColor)}
                  style={{ backgroundColor: 'hsl(var(--background))' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <Icon className={cn(
                'relative w-4 h-4 transition-colors flex-shrink-0',
                isActive ? config.color : ''
              )} />
              {showLabels && (
                <span className="relative text-[11px] sm:text-sm font-medium truncate">
                  {config.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <RehomeDialog 
        open={showRehomeDialog}
        onOpenChange={setShowRehomeDialog}
        data={rehomeData}
        onDataChange={setRehomeData}
        onSubmit={handleRehomeSubmit}
        isLoading={isLoading}
      />
    </>
  );
}

interface RehomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    phoneNumber: string;
    city: string;
    state: string;
    reasonForRehoming: string;
  };
  onDataChange: (data: RehomeDialogProps['data']) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

function RehomeDialog({ open, onOpenChange, data, onDataChange, onSubmit, isLoading }: RehomeDialogProps) {
  const config = MODE_CONFIGS.rehome;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <HeartHandshake className={cn("w-5 h-5", config.color)} />
            </div>
            Switch to Rehome Mode
          </DialogTitle>
          <DialogDescription>
            Before listing your dog, we need a few details to help connect you with foster volunteers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={data.phoneNumber}
              onChange={(e) => onDataChange({ ...data, phoneNumber: e.target.value })}
              data-testid="input-rehome-phone"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="Austin"
                value={data.city}
                onChange={(e) => onDataChange({ ...data, city: e.target.value })}
                data-testid="input-rehome-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                placeholder="TX"
                value={data.state}
                onChange={(e) => onDataChange({ ...data, state: e.target.value })}
                data-testid="input-rehome-state"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Why are you rehoming? *</Label>
            <Textarea
              id="reason"
              placeholder="Tell us about your situation..."
              value={data.reasonForRehoming}
              onChange={(e) => onDataChange({ ...data, reasonForRehoming: e.target.value })}
              className="min-h-[100px]"
              data-testid="input-rehome-reason"
            />
            <p className="text-xs text-muted-foreground">
              This helps us match you with understanding foster volunteers.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isLoading} data-testid="button-confirm-rehome">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Switching...
              </>
            ) : (
              'Switch to Rehome'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModeIndicator({ className }: { className?: string }) {
  const { currentMode, isTransitioning } = useRoleSwitch();
  const config = MODE_CONFIGS[currentMode];
  const Icon = MODE_ICONS[currentMode];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentMode}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        <Badge 
          variant="outline" 
          className={cn(
            'gap-1.5 transition-all duration-200',
            config.bgColor,
            config.color,
            isTransitioning && 'animate-pulse',
            className
          )}
        >
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}

export function ModeAwareSection({ 
  mode, 
  children,
  fallback = null,
}: { 
  mode: UserMode | UserMode[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { currentMode } = useRoleSwitch();
  const modes = Array.isArray(mode) ? mode : [mode];
  
  if (!modes.includes(currentMode)) {
    return <>{fallback}</>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentMode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
