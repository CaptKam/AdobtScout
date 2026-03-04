import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ColorScheme = 'default' | 'purple' | 'blue' | 'green' | 'red' | 'teal' | 'indigo';
export type SidebarStyle = 'light' | 'dark' | 'primary' | 'gradient-indigo' | 'gradient-blue' | 'gradient-green' | 'gradient-purple' | 'gradient-orange';
export type NavbarStyle = 'light' | 'dark' | 'primary';

interface ThemeState {
  isDark: boolean;
  colorScheme: ColorScheme;
  sidebarCollapsed: boolean;
  sidebarStyle: SidebarStyle;
  navbarStyle: NavbarStyle;
  isCustomizerOpen: boolean;
  
  toggleDarkMode: () => void;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarStyle: (style: SidebarStyle) => void;
  setNavbarStyle: (style: NavbarStyle) => void;
  toggleCustomizer: () => void;
  closeCustomizer: () => void;
  resetToDefaults: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      isDark: false,
      colorScheme: 'default',
      sidebarCollapsed: false,
      sidebarStyle: 'dark',
      navbarStyle: 'light',
      isCustomizerOpen: false,
      
      toggleDarkMode: () => {
        const newIsDark = !get().isDark;
        set({ isDark: newIsDark });
        if (newIsDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      
      setColorScheme: (scheme) => {
        set({ colorScheme: scheme });
        document.documentElement.setAttribute('data-color-scheme', scheme);
      },
      
      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      
      setSidebarStyle: (style) => {
        set({ sidebarStyle: style });
        document.documentElement.setAttribute('data-sidebar-style', style);
      },
      
      setNavbarStyle: (style) => {
        set({ navbarStyle: style });
        document.documentElement.setAttribute('data-navbar-style', style);
      },
      
      toggleCustomizer: () => set({ isCustomizerOpen: !get().isCustomizerOpen }),
      closeCustomizer: () => set({ isCustomizerOpen: false }),
      
      resetToDefaults: () => {
        set({
          isDark: false,
          colorScheme: 'default',
          sidebarStyle: 'dark',
          navbarStyle: 'light',
        });
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-color-scheme', 'default');
        document.documentElement.setAttribute('data-sidebar-style', 'dark');
        document.documentElement.setAttribute('data-navbar-style', 'light');
      },
    }),
    {
      name: 'scout-theme-preferences',
      partialize: (state) => ({
        isDark: state.isDark,
        colorScheme: state.colorScheme,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarStyle: state.sidebarStyle,
        navbarStyle: state.navbarStyle,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.isDark) {
            document.documentElement.classList.add('dark');
          }
          if (state.colorScheme) {
            document.documentElement.setAttribute('data-color-scheme', state.colorScheme);
          }
          if (state.sidebarStyle) {
            document.documentElement.setAttribute('data-sidebar-style', state.sidebarStyle);
          }
          if (state.navbarStyle) {
            document.documentElement.setAttribute('data-navbar-style', state.navbarStyle);
          }
        }
      },
    }
  )
);
