import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, Archive, XCircle } from "lucide-react";

type ActionType = "delete" | "archive" | "cancel" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  actionType?: ActionType;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

const ACTION_ICONS = {
  delete: Trash2,
  archive: Archive,
  cancel: XCircle,
  warning: AlertTriangle,
};

const ACTION_COLORS = {
  delete: "bg-red-500 hover:bg-red-600 text-white border-red-500",
  archive: "bg-orange-500 hover:bg-orange-600 text-white border-orange-500",
  cancel: "bg-muted-foreground hover:bg-muted-foreground/80 text-white border-muted-foreground",
  warning: "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500",
};

const ACTION_ICON_COLORS = {
  delete: "text-red-500",
  archive: "text-orange-500",
  cancel: "text-muted-foreground",
  warning: "text-yellow-500",
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  actionType = "warning",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const Icon = ACTION_ICONS[actionType];

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsPending(false);
    }
  };

  const loading = isLoading || isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md" data-testid="confirm-dialog">
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full bg-muted ${ACTION_ICON_COLORS[actionType]}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-lg" data-testid="confirm-dialog-title">
                {title}
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2" data-testid="confirm-dialog-description">
                {description}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel 
            disabled={loading}
            data-testid="confirm-dialog-cancel"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={ACTION_COLORS[actionType]}
            data-testid="confirm-dialog-confirm"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    title: string;
    description: string;
    actionType: ActionType;
    confirmLabel: string;
    onConfirm: () => void | Promise<void>;
  }>({
    open: false,
    title: "",
    description: "",
    actionType: "warning",
    confirmLabel: "Confirm",
    onConfirm: () => {},
  });

  const confirm = ({
    title,
    description,
    actionType = "warning",
    confirmLabel = "Confirm",
    onConfirm,
  }: {
    title: string;
    description: string;
    actionType?: ActionType;
    confirmLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setDialogState({
      open: true,
      title,
      description,
      actionType,
      confirmLabel,
      onConfirm,
    });
  };

  const closeDialog = () => {
    setDialogState((prev) => ({ ...prev, open: false }));
  };

  return {
    confirm,
    dialogProps: {
      open: dialogState.open,
      onOpenChange: (open: boolean) => setDialogState((prev) => ({ ...prev, open })),
      title: dialogState.title,
      description: dialogState.description,
      actionType: dialogState.actionType,
      confirmLabel: dialogState.confirmLabel,
      onConfirm: dialogState.onConfirm,
    },
  };
}
