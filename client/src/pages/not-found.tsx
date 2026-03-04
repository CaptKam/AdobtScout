import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-2xl font-bold">Page Not Found</h2>
          <p className="text-muted-foreground max-w-md">
            The page you're looking for doesn't exist. Let's get you back on track!
          </p>
        </div>
        
        <Button onClick={() => setLocation("/discover")} size="lg" data-testid="button-home">
          <Home className="w-5 h-5 mr-2" />
          Go to Discover
        </Button>
      </div>
    </div>
  );
}
