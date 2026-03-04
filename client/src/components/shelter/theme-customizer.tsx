import { Settings, X, Sun, Moon, Monitor, Palette, Layout, Sidebar as SidebarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useThemeStore, type ColorScheme, type SidebarStyle, type NavbarStyle } from "@/stores/theme-store";

const COLOR_SCHEMES: { value: ColorScheme; label: string; color: string }[] = [
  { value: 'default', label: 'Scout Orange', color: '#c85a28' },
  { value: 'purple', label: 'Royal Purple', color: '#666ee8' },
  { value: 'blue', label: 'Ocean Blue', color: '#0066cc' },
  { value: 'green', label: 'Forest Green', color: '#28a745' },
  { value: 'red', label: 'Ruby Red', color: '#dc3545' },
  { value: 'teal', label: 'Aqua Teal', color: '#00796B' },
  { value: 'indigo', label: 'Deep Indigo', color: '#303F9F' },
];

const SIDEBAR_STYLES: { value: SidebarStyle; label: string; preview: string; description: string }[] = [
  { value: 'light', label: 'Light', preview: 'bg-white', description: 'Clean white sidebar' },
  { value: 'dark', label: 'Dark', preview: 'bg-gray-900', description: 'Modern dark sidebar' },
  { value: 'primary', label: 'Branded', preview: 'bg-primary', description: 'Primary color theme' },
];

const GRADIENT_SIDEBAR_STYLES: { value: SidebarStyle; label: string; gradient: string }[] = [
  { value: 'gradient-indigo', label: 'Indigo', gradient: 'linear-gradient(180deg, #303F9F 0%, #061157 100%)' },
  { value: 'gradient-blue', label: 'Blue', gradient: 'linear-gradient(180deg, #1F6DB2 0%, #0B477D 100%)' },
  { value: 'gradient-green', label: 'Green', gradient: 'linear-gradient(180deg, #0ECD94 0%, #0D7858 100%)' },
  { value: 'gradient-purple', label: 'Purple', gradient: 'linear-gradient(180deg, #974CC5 0%, #45066C 100%)' },
  { value: 'gradient-orange', label: 'Orange', gradient: 'linear-gradient(180deg, #F67934 0%, #A23C05 100%)' },
];

const NAVBAR_STYLES: { value: NavbarStyle; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'primary', label: 'Branded' },
];

export function ThemeCustomizer() {
  const {
    isDark,
    colorScheme,
    sidebarStyle,
    navbarStyle,
    isCustomizerOpen,
    toggleDarkMode,
    setColorScheme,
    setSidebarStyle,
    setNavbarStyle,
    toggleCustomizer,
    closeCustomizer,
    resetToDefaults,
  } = useThemeStore();

  return (
    <>
      {/* Floating Toggle Button - Modern Admin Style */}
      <button
        onClick={toggleCustomizer}
        className={cn(
          "fixed z-50 flex items-center justify-center",
          "w-12 h-12 rounded-l-xl",
          "bg-primary text-primary-foreground",
          "shadow-lg hover:shadow-xl",
          "transition-all duration-300",
          "top-1/3",
          isCustomizerOpen ? "right-[400px]" : "right-0"
        )}
        data-testid="button-theme-customizer-toggle"
      >
        <Settings className={cn("w-5 h-5 transition-transform duration-500", isCustomizerOpen && "rotate-180")} />
      </button>

      {/* Backdrop */}
      {isCustomizerOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
          onClick={closeCustomizer}
          data-testid="backdrop-theme-customizer"
        />
      )}

      {/* Customizer Panel */}
      <div
        className={cn(
          "fixed top-0 bottom-0 right-0 z-50",
          "w-[400px] max-w-[90vw]",
          "bg-card border-l border-border",
          "shadow-2xl",
          "transition-transform duration-300 ease-out",
          isCustomizerOpen ? "translate-x-0" : "translate-x-full"
        )}
        data-testid="panel-theme-customizer"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Theme Customizer</h2>
              <p className="text-xs text-muted-foreground">Personalize your workspace</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={closeCustomizer}
            data-testid="button-close-customizer"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-6 space-y-8">
            {/* Dark Mode Toggle */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Appearance</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => { if (isDark) toggleDarkMode(); }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    !isDark
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  data-testid="button-theme-light"
                >
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                    <Sun className="w-5 h-5 text-amber-500" />
                  </div>
                  <span className="text-sm font-medium">Light</span>
                </button>
                
                <button
                  onClick={() => { if (!isDark) toggleDarkMode(); }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    isDark
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  data-testid="button-theme-dark"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-900 border border-gray-700 flex items-center justify-center">
                    <Moon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm font-medium">Dark</span>
                </button>
                
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                    "border-border opacity-50 cursor-not-allowed"
                  )}
                  disabled
                  data-testid="button-theme-system"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-white to-gray-900 border border-gray-300 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-gray-600" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">System</span>
                </button>
              </div>
            </section>

            <Separator />

            {/* Color Scheme */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Brand Color</h3>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.value}
                    onClick={() => setColorScheme(scheme.value)}
                    className={cn(
                      "relative w-11 h-11 rounded-xl transition-all",
                      "ring-2 ring-offset-2 ring-offset-background",
                      colorScheme === scheme.value
                        ? "ring-primary scale-110"
                        : "ring-transparent hover:ring-border"
                    )}
                    style={{ backgroundColor: scheme.color }}
                    title={scheme.label}
                    data-testid={`button-color-${scheme.value}`}
                  >
                    {colorScheme === scheme.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 rounded-full bg-white shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {COLOR_SCHEMES.find(s => s.value === colorScheme)?.label}
              </p>
            </section>

            <Separator />

            {/* Sidebar Style - Solid Colors */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <SidebarIcon className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Sidebar Style</h3>
              </div>
              
              <div className="space-y-2">
                {SIDEBAR_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setSidebarStyle(style.value)}
                    className={cn(
                      "w-full flex items-center gap-4 p-3 rounded-lg border-2 transition-all text-left",
                      sidebarStyle === style.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    data-testid={`button-sidebar-${style.value}`}
                  >
                    <div
                      className={cn(
                        "w-12 h-16 rounded-md border flex-shrink-0",
                        style.value === 'light' && "bg-white border-gray-200",
                        style.value === 'dark' && "bg-gray-900 border-gray-700",
                        style.value === 'primary' && "bg-primary border-primary"
                      )}
                    >
                      <div className="p-1.5 space-y-1">
                        <div className={cn(
                          "h-1.5 w-full rounded-sm",
                          style.value === 'light' && "bg-gray-300",
                          style.value === 'dark' && "bg-gray-600",
                          style.value === 'primary' && "bg-white/30"
                        )} />
                        <div className={cn(
                          "h-1.5 w-3/4 rounded-sm",
                          style.value === 'light' && "bg-gray-200",
                          style.value === 'dark' && "bg-gray-700",
                          style.value === 'primary' && "bg-white/20"
                        )} />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{style.label}</p>
                      <p className="text-xs text-muted-foreground">{style.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Gradient Sidebar Options */}
              <p className="text-xs text-muted-foreground mt-4 mb-3">Gradient Sidebars</p>
              <div className="grid grid-cols-5 gap-2">
                {GRADIENT_SIDEBAR_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setSidebarStyle(style.value)}
                    className={cn(
                      "relative w-full aspect-[3/4] rounded-lg transition-all overflow-hidden",
                      "ring-2 ring-offset-1 ring-offset-background",
                      sidebarStyle === style.value
                        ? "ring-primary scale-105"
                        : "ring-transparent hover:ring-border"
                    )}
                    style={{ background: style.gradient }}
                    title={style.label}
                    data-testid={`button-sidebar-${style.value}`}
                  >
                    <div className="p-1 space-y-0.5 opacity-50">
                      <div className="h-1 w-full rounded-sm bg-white/40" />
                      <div className="h-1 w-3/4 rounded-sm bg-white/30" />
                      <div className="h-1 w-1/2 rounded-sm bg-white/20" />
                    </div>
                    {sidebarStyle === style.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {[...SIDEBAR_STYLES, ...GRADIENT_SIDEBAR_STYLES].find(s => s.value === sidebarStyle)?.label}
              </p>
            </section>

            <Separator />

            {/* Navbar Style */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Layout className="w-4 h-4 text-primary" />
                <h3 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">Navbar Style</h3>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {NAVBAR_STYLES.map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setNavbarStyle(style.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      navbarStyle === style.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                    data-testid={`button-navbar-${style.value}`}
                  >
                    <div className="w-full h-8 rounded-md overflow-hidden border border-border">
                      <div
                        className={cn(
                          "w-full h-2",
                          style.value === 'light' && "bg-white",
                          style.value === 'dark' && "bg-gray-900",
                          style.value === 'primary' && "bg-primary"
                        )}
                      />
                      <div className="bg-muted h-6" />
                    </div>
                    <span className="text-xs font-medium">{style.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <Separator />

            {/* Reset Section */}
            <section className="pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={resetToDefaults}
                data-testid="button-reset-theme"
              >
                Reset to Default
              </Button>
            </section>
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
