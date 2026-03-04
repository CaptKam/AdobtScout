import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Heart, Eye, EyeOff, ArrowLeft, Loader2, Building2 } from "lucide-react";

// Define apiRequest function if it's not globally available or imported elsewhere
// For this example, assuming a basic fetch wrapper for demonstration
async function apiRequest(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `API Error: ${response.statusText}`);
  }
  return response.json();
}


interface AuthFormProps {
  mode: 'signup' | 'login';
  intendedRole?: 'adopter' | 'shelter' | 'owner';
  onSuccess?: () => void;
}

export function AuthForm({ mode, intendedRole = 'adopter', onSuccess }: AuthFormProps) {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(""); // Assuming a state for form errors
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      // Clear any existing session before login/signup
      try {
        await apiRequest("POST", "/api/logout", {});
      } catch (e) {
        // Ignore logout errors
      }
      queryClient.clear();

      if (mode === 'signup') {
        const endpoint = '/api/signup';
        const body = { email, password, firstName, lastName, role: intendedRole };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Signup failed');
        }

        // Upon successful signup
        toast({
          title: "Welcome to Scout!",
          description: "Let's find your perfect companion",
        });

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        } else {
          // Default navigation if no callback provided
          navigate("/onboarding");
        }
      } else { // mode === 'login'
        const endpoint = '/api/login';
        const body = { email, password };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Login failed');
        }

        // Upon successful login
        toast({
          title: "Welcome back!",
          description: "Good to see you again",
        });

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess();
        } else {
          // Default navigation if no callback provided
          navigate("/onboarding");
        }
      }
    } catch (error: any) {
      setError(error.message); // Set local error state for the form
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto rounded-3xl border-0 shadow-xl -mt-[75px]">
      <CardContent className="p-8">
        {/* Scout Branding */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
              <Heart className="w-6 h-6 text-primary-foreground fill-current" />
            </div>
          </div>
          <h1 className="font-serif text-2xl font-bold mb-1">
            {mode === 'signup' ? 'Join Scout' : 'Welcome Back'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === 'signup'
              ? 'Find your perfect furry companion'
              : 'Sign in to continue your journey'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error display */}
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-auth-error">
              {error}
            </div>
          )}

          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName" className="text-sm font-medium mb-1.5 block">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="h-12 text-base rounded-xl"
                  autoCapitalize="words"
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-sm font-medium mb-1.5 block">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="h-12 text-base rounded-xl"
                  autoCapitalize="words"
                  data-testid="input-last-name"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="email" className="text-sm font-medium mb-1.5 block">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="h-12 text-base rounded-xl"
              autoComplete="email"
              inputMode="email"
              data-testid="input-email"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium mb-1.5 block">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={8}
                className="h-12 text-base rounded-xl pr-12"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                tabIndex={-1}
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {mode === 'signup' && (
              <p className="text-xs text-muted-foreground mt-2">
                At least 8 characters with uppercase, lowercase, and number
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold rounded-xl mt-2"
            disabled={isLoading}
            data-testid="button-submit-auth"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {mode === 'signup' ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              mode === 'signup' ? 'Create Account' : 'Sign In'
            )}
          </Button>
        </form>

        {/* OAuth Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-card text-muted-foreground">Or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium rounded-xl"
            onClick={() => window.location.href = `/api/auth/google?intended_role=${intendedRole}`}
            data-testid="button-google-auth"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </Button>

          {mode === 'login' && (
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-medium rounded-xl border-primary/50 hover:bg-primary/5"
              onClick={async () => {
                setIsLoading(true);
                setError(""); // Clear previous errors
                try {
                  // Clear any existing session before demo login
                  try {
                    await apiRequest("POST", "/api/logout", {});
                  } catch (e) {
                    // Ignore logout errors
                  }
                  queryClient.clear();

                  const response = await fetch('/api/demo-login', {
                    method: 'POST',
                    credentials: 'include',
                  });

                  if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Demo login failed');
                  }

                  toast({
                    title: "Welcome!",
                    description: "You're now using the demo account",
                  });

                  if (onSuccess) {
                    onSuccess();
                  } else {
                    navigate("/onboarding");
                  }
                } catch (error: any) {
                  setError(error.message);
                  toast({
                    title: "Error",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              data-testid="button-demo-login"
            >
              <Heart className="w-5 h-5 mr-2" />
              Try Demo Account
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium rounded-xl relative"
            disabled
            data-testid="button-apple-auth"
          >
            <svg className="w-5 h-5 mr-2 opacity-50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span className="opacity-50">Continue with Apple</span>
            <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-semibold">
              Coming Soon
            </span>
          </Button>
        </div>

        {/* Switch mode link */}
        <div className="text-center text-sm mt-6 pt-6 border-t">
          {mode === 'signup' ? (
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <a
                href={`/login?intended_role=${intendedRole}`}
                className="text-primary font-semibold hover:underline"
                data-testid="link-switch-to-login"
              >
                Sign in
              </a>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <a
                href={`/signup?intended_role=${intendedRole}`}
                className="text-primary font-semibold hover:underline"
                data-testid="link-switch-to-signup"
              >
                Sign up
              </a>
            </p>
          )}
        </div>

        {/* Shelter login link */}
        {mode === 'login' && intendedRole !== 'shelter' && (
          <div className="text-center text-sm mt-4">
            <p className="text-muted-foreground">
              Are you a shelter?{' '}
              <a
                href="/shelter/login"
                className="text-primary font-semibold hover:underline inline-flex items-center gap-1"
                data-testid="link-shelter-login"
              >
                <Building2 className="w-3.5 h-3.5" />
                Shelter Login
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}