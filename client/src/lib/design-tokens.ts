import { MODE_TOKEN_CLASSES, type UserMode } from './role-switch-engine';
export type { UserMode };

export const MODE_COLORS = {
  adopt: {
    ...MODE_TOKEN_CLASSES.adopt,
    border: 'border-[hsl(var(--mode-adopt))]',
    ring: 'ring-[hsl(var(--mode-adopt))]',
    hsl: 'hsl(var(--mode-adopt))',
    hslMuted: 'hsl(var(--mode-adopt-muted))',
    cssVar: '--mode-adopt',
  },
  foster: {
    ...MODE_TOKEN_CLASSES.foster,
    border: 'border-[hsl(var(--mode-foster))]',
    ring: 'ring-[hsl(var(--mode-foster))]',
    hsl: 'hsl(var(--mode-foster))',
    hslMuted: 'hsl(var(--mode-foster-muted))',
    cssVar: '--mode-foster',
  },
  rehome: {
    ...MODE_TOKEN_CLASSES.rehome,
    border: 'border-[hsl(var(--mode-rehome))]',
    ring: 'ring-[hsl(var(--mode-rehome))]',
    hsl: 'hsl(var(--mode-rehome))',
    hslMuted: 'hsl(var(--mode-rehome-muted))',
    cssVar: '--mode-rehome',
  },
} as const;

export const ENERGY_LEVELS = {
  low: { label: 'Low Energy', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  moderate: { label: 'Moderate', color: 'bg-green-500/10 text-green-700 dark:text-green-300' },
  high: { label: 'High Energy', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  very_high: { label: 'Very High', color: 'bg-red-500/10 text-red-700 dark:text-red-300' },
} as const;

export const SIZE_LABELS = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  any: 'Any Size',
} as const;

export const TIME_COMMITMENT_LABELS = {
  short_term: '2-4 weeks',
  medium_term: '1-2 months',
  long_term: '2+ months',
  flexible: 'Flexible',
} as const;

export const EMERGENCY_LABELS = {
  same_day: 'Same Day',
  few_days: 'Few Days',
  week_notice: 'Week Notice',
  month_notice: 'Month Notice',
} as const;

export const TYPOGRAPHY = {
  pageTitle: 'text-2xl sm:text-3xl font-bold',
  sectionTitle: 'text-lg sm:text-xl font-semibold',
  cardTitle: 'text-base sm:text-lg font-semibold',
  subtitle: 'text-sm text-muted-foreground',
  body: 'text-sm sm:text-base',
  caption: 'text-xs text-muted-foreground',
} as const;

export const SPACING = {
  page: 'p-4 sm:p-6',
  section: 'space-y-4 sm:space-y-6',
  card: 'p-4 sm:p-5',
  cardCompact: 'p-3 sm:p-4',
  gap: 'gap-3 sm:gap-4',
  gapLarge: 'gap-4 sm:gap-6',
} as const;

export const CARD_STYLES = {
  base: 'rounded-2xl border shadow-sm transition-all',
  elevated: 'rounded-2xl border-0 shadow-lg',
  interactive: 'rounded-2xl border shadow-sm hover-elevate cursor-pointer',
  swipe: 'rounded-3xl border-0 swipe-card-shadow overflow-hidden',
} as const;

export const BADGE_STYLES = {
  mode: (mode: UserMode) => `${MODE_COLORS[mode].bg} ${MODE_COLORS[mode].textForeground}`,
  modeMuted: (mode: UserMode) => `${MODE_COLORS[mode].bgMuted} ${MODE_COLORS[mode].text}`,
  success: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  danger: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
} as const;

export const EMPTY_STATE_STYLES = {
  container: 'h-full flex items-center justify-center px-4 bg-gradient-to-b from-background via-background to-muted/20',
  content: 'text-center space-y-6 max-w-md animate-fadeInUp',
  iconContainer: 'w-24 h-24 bg-gradient-to-br from-muted/40 to-muted/10 rounded-2xl flex items-center justify-center',
  icon: 'w-12 h-12 text-muted-foreground/60',
  title: 'text-2xl sm:text-3xl font-bold mb-2',
  description: 'text-muted-foreground text-base sm:text-lg leading-relaxed',
} as const;

export const LOADING_STATE_STYLES = {
  container: 'h-full flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20',
  content: 'text-center space-y-6 max-w-md',
  iconContainer: 'w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-muted/40 to-muted/10 rounded-2xl flex items-center justify-center',
  icon: 'w-12 h-12 text-muted-foreground/60 animate-pulse',
  title: 'text-2xl sm:text-3xl font-bold animate-fadeInUp',
  description: 'text-muted-foreground text-base sm:text-lg animate-fadeInUp pt-2',
} as const;

export function getModeColor(mode: UserMode) {
  return MODE_COLORS[mode];
}

export function getModeIcon(mode: UserMode) {
  const icons = {
    adopt: 'Heart',
    foster: 'Home',
    rehome: 'HeartHandshake',
  };
  return icons[mode];
}
