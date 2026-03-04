import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { AuthForm } from "@/components/auth-form";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  likeCount?: number;
}

export function AuthModal({ open, onOpenChange, likeCount = 0 }: AuthModalProps) {
  const [, setLocation] = useLocation();

  const handleSuccess = () => {
    queryClient.clear();
    onOpenChange(false);
    setLocation("/discover");
  };

  const handleAuth = () => {
    // Redirect to signup page with adopter role
    window.location.href = "/signup?intended_role=adopter";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-primary fill-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Save your matches?
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            You've liked {likeCount} dogs! Create a free account to save your favorites and get notified when similar dogs appear near you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          <Button
            onClick={handleAuth}
            className="w-full h-12 text-base"
            data-testid="button-create-account"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Create Free Account
          </Button>

          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
            data-testid="button-continue-browsing"
          >
            Continue Browsing
          </Button>
        </div>

        <div className="pt-3 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <a
              href="/login?intended_role=adopter"
              className="text-primary hover:underline font-medium"
              data-testid="link-sign-in-modal"
            >
              Sign In
            </a>
          </p>
        </div>

        <p className="text-xs text-center text-muted-foreground pt-2">
          Free forever • No credit card required • Secure authentication
        </p>
      </DialogContent>
    </Dialog>
  );
}