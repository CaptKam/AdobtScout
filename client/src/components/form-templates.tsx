import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormStepperProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function FormStepper({ currentStep, totalSteps, stepLabels }: FormStepperProps) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 h-2 rounded-full transition-colors",
              i < currentStep ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>
      {stepLabels && stepLabels[currentStep - 1] && (
        <p className="text-xs text-muted-foreground">
          Step {currentStep} of {totalSteps}: {stepLabels[currentStep - 1]}
        </p>
      )}
    </div>
  );
}

interface FormSectionProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "highlight" | "ai";
  children?: ReactNode;
  className?: string;
}

export function FormSection({ 
  title, 
  description, 
  icon: Icon, 
  variant = "default",
  children,
  className 
}: FormSectionProps) {
  const variants = {
    default: "",
    highlight: "p-4 rounded-lg bg-muted/50 border",
    ai: "p-3 sm:p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20",
  };

  return (
    <div className={cn("space-y-3", variants[variant], className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <div className="flex items-center gap-2">
              {Icon && <Icon className="w-5 h-5 text-primary shrink-0" />}
              <span className="font-medium">{title}</span>
            </div>
          )}
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

interface FormActionsProps {
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  isLoading?: boolean;
  disabled?: boolean;
}

export function FormActions({
  onBack,
  onNext,
  onSubmit,
  backLabel = "Back",
  nextLabel = "Next",
  submitLabel = "Submit",
  isFirstStep = false,
  isLastStep = false,
  isLoading = false,
  disabled = false,
}: FormActionsProps) {
  return (
    <div className="flex flex-col-reverse sm:flex-row justify-between gap-2 pt-4 border-t">
      {!isFirstStep && onBack ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          data-testid="button-form-back"
        >
          {backLabel}
        </Button>
      ) : (
        <div />
      )}
      {isLastStep ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isLoading || disabled}
          data-testid="button-form-submit"
        >
          {isLoading ? "Submitting..." : submitLabel}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={isLoading || disabled}
          data-testid="button-form-next"
        >
          {nextLabel}
        </Button>
      )}
    </div>
  );
}

interface CardOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  description?: string;
}

interface VisualCardSelectorProps {
  options: CardOption[];
  value: string | string[];
  onChange: (value: string) => void;
  columns?: 2 | 3 | 4;
  multiple?: boolean;
  testIdPrefix?: string;
}

export function VisualCardSelector({
  options,
  value,
  onChange,
  columns = 3,
  multiple = false,
  testIdPrefix = "card-option",
}: VisualCardSelectorProps) {
  const isSelected = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const columnClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-2 sm:gap-3", columnClasses[columns])}>
      {options.map((option) => {
        const Icon = option.icon;
        const selected = isSelected(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "p-3 sm:p-4 rounded-lg border-2 text-left transition-all hover-elevate",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
            data-testid={`${testIdPrefix}-${option.value}`}
          >
            {Icon && (
              <Icon
                className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-2",
                  selected ? "text-primary" : "text-muted-foreground"
                )}
              />
            )}
            <p className={cn("font-medium text-xs sm:text-sm", selected && "text-primary")}>
              {option.label}
            </p>
            {option.description && (
              <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                {option.description}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface PhotoGridProps {
  photos: string[];
  onRemove: (index: number) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading?: boolean;
  maxPhotos?: number;
  columns?: 3 | 4;
  fileInputRef?: React.RefObject<HTMLInputElement>;
}

export function PhotoGrid({
  photos,
  onRemove,
  onUpload,
  uploading = false,
  maxPhotos = 6,
  columns = 4,
  fileInputRef,
}: PhotoGridProps) {
  const columnClasses = {
    3: "grid-cols-3",
    4: "grid-cols-3 sm:grid-cols-4",
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs sm:text-sm font-medium">Photos</label>
      <div className={cn("grid gap-2", columnClasses[columns])}>
        {photos.map((photo, index) => (
          <div
            key={index}
            className="relative aspect-square rounded-lg overflow-hidden bg-muted group"
          >
            <img
              src={photo}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={() => onRemove(index)}
                className="h-6 w-6"
                data-testid={`button-remove-photo-${index}`}
              >
                <span className="sr-only">Remove</span>
                ×
              </Button>
            </div>
          </div>
        ))}
        {photos.length < maxPhotos && (
          <label
            className={cn(
              "aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors",
              uploading && "opacity-50 pointer-events-none"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onUpload}
              className="hidden"
              disabled={uploading}
              data-testid="input-photo-upload"
            />
            {uploading ? (
              <div className="w-5 h-5 border-2 border-muted-foreground/50 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="text-xl text-muted-foreground mb-1">+</span>
                <span className="text-xs text-muted-foreground">Add</span>
              </>
            )}
          </label>
        )}
      </div>
    </div>
  );
}

interface FormFieldGridProps {
  columns?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}

export function FormFieldGrid({ columns = 2, children, className }: FormFieldGridProps) {
  const columnClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
  };

  return (
    <div className={cn("grid gap-4", columnClasses[columns], className)}>
      {children}
    </div>
  );
}

interface FormDialogLayoutProps {
  children: ReactNode;
  className?: string;
}

export function FormDialogLayout({ children, className }: FormDialogLayoutProps) {
  return (
    <div className={cn("flex-1 min-h-0 overflow-y-auto pr-2", className)}>
      {children}
    </div>
  );
}
