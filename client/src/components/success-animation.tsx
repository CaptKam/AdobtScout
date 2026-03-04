import { useEffect, useState, useCallback } from "react";
import { Check, CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuccessAnimationProps {
  show: boolean;
  onComplete?: () => void;
  variant?: "check" | "checkCircle" | "celebrate" | "sparkle";
  size?: "sm" | "md" | "lg";
  message?: string;
  duration?: number;
}

const VARIANTS = {
  check: Check,
  checkCircle: CheckCircle2,
  celebrate: PartyPopper,
  sparkle: Sparkles,
};

const SIZES = {
  sm: { icon: "w-6 h-6", container: "w-10 h-10", text: "text-sm" },
  md: { icon: "w-8 h-8", container: "w-14 h-14", text: "text-base" },
  lg: { icon: "w-12 h-12", container: "w-20 h-20", text: "text-lg" },
};

export function SuccessAnimation({
  show,
  onComplete,
  variant = "checkCircle",
  size = "md",
  message,
  duration = 2000,
}: SuccessAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = VARIANTS[variant];
  const sizeClasses = SIZES[size];

  const dismiss = useCallback(() => {
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      const timer = setTimeout(dismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, dismiss]);

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        dismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, dismiss]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200 cursor-pointer"
      data-testid="success-animation"
      onClick={dismiss}
      role="status"
      aria-live="polite"
      aria-label={message || "Success"}
    >
      <div className="flex flex-col items-center gap-4 animate-in zoom-in-50 duration-300">
        <div 
          className={cn(
            "rounded-full bg-green-500 flex items-center justify-center text-white",
            "animate-in zoom-in-0 duration-500",
            sizeClasses.container
          )}
          style={{
            animation: "success-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}
        >
          <Icon className={cn(sizeClasses.icon, "animate-in zoom-in-0 duration-300 delay-200")} />
        </div>
        {message && (
          <p className={cn(
            "font-medium text-foreground animate-in fade-in slide-in-from-bottom-2 duration-300 delay-300",
            sizeClasses.text
          )}>
            {message}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">Click or press any key to dismiss</p>
      </div>
    </div>
  );
}

export function InlineSuccessCheck({ 
  show, 
  className 
}: { 
  show: boolean; 
  className?: string;
}) {
  if (!show) return null;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white",
        "animate-in zoom-in-0 duration-300",
        className
      )}
      data-testid="inline-success-check"
    >
      <Check className="w-3 h-3" />
    </span>
  );
}

export function TaskCompletionAnimation({ 
  show,
  onComplete 
}: { 
  show: boolean;
  onComplete?: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-green-500/10 rounded-lg pointer-events-none animate-in fade-in duration-200"
      data-testid="task-completion-animation"
    >
      <div className="flex items-center gap-2 text-green-600 font-medium animate-in zoom-in-50 duration-300">
        <CheckCircle2 className="w-5 h-5" />
        <span>Done!</span>
      </div>
    </div>
  );
}

export function useSuccessAnimation() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const triggerSuccess = (successMessage?: string) => {
    setMessage(successMessage);
    setShowSuccess(true);
  };

  const hideSuccess = () => {
    setShowSuccess(false);
    setMessage(undefined);
  };

  return {
    showSuccess,
    message,
    triggerSuccess,
    hideSuccess,
  };
}
