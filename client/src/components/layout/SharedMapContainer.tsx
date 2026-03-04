import { useRoleSwitch } from "@/lib/role-switch-engine";
import { MODE_COLORS } from "@/lib/design-tokens";

interface SharedMapContainerProps {
  children: React.ReactNode;
  className?: string;
  showModeIndicator?: boolean;
}

export function SharedMapContainer({ 
  children, 
  className = "",
  showModeIndicator = false 
}: SharedMapContainerProps) {
  const { currentMode, modeConfig } = useRoleSwitch();
  const modeColors = MODE_COLORS[currentMode];

  return (
    <div className={`relative h-full w-full ${className}`}>
      {showModeIndicator && (
        <div 
          className={`absolute top-4 left-4 z-[1000] px-3 py-1.5 rounded-full ${modeColors.bgMuted} backdrop-blur-sm shadow-sm`}
          data-testid="map-mode-indicator"
        >
          <span className={`text-xs font-medium ${modeColors.text}`}>
            {modeConfig.label} Mode
          </span>
        </div>
      )}
      
      <div className="h-full w-full" data-testid="map-container">
        {children}
      </div>
    </div>
  );
}
