import { useLocation } from "wouter";
import { AuthForm } from "@/components/auth-form";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const intendedRole = (searchParams.get('intended_role') || 'adopter') as 'adopter' | 'shelter' | 'owner';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Back button */}
      <div className="p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="text-muted-foreground hover:text-foreground"
          data-testid="button-back-to-home"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
      
      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center p-4 pb-12">
        <AuthForm mode="signup" intendedRole={intendedRole} />
      </div>
    </div>
  );
}
