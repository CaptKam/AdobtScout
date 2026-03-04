import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Building2, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const shelterLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type ShelterLoginForm = z.infer<typeof shelterLoginSchema>;

export default function ShelterLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ShelterLoginForm>({
    resolver: zodResolver(shelterLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: ShelterLoginForm) => {
      // First, clear any existing session
      try {
        await apiRequest("POST", "/api/logout", {});
      } catch (e) {
        // Ignore logout errors, session might not exist
      }
      
      // Clear all cached queries
      queryClient.clear();
      
      // Then attempt shelter login
      const response = await apiRequest("POST", "/api/auth/shelter-login", data);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({
        title: "Welcome back!",
        description: "Redirecting to your shelter dashboard...",
      });
      setLocation("/shelter/operations");
    },
    onError: (error: any) => {
      setError(error.message || "Invalid credentials or account not found");
      toast({
        title: "Login failed",
        description: error.message || "Invalid credentials or account not found",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ShelterLoginForm) => {
    setError(null);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-lg shadow-primary/20 mb-4">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Shelter Portal</h1>
          <p className="text-slate-400">Manage your dogs and applications</p>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Shelter Login</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your shelter account credentials to access the CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Email Address</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="shelter@organization.com"
                          disabled={loginMutation.isPending}
                          className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                          data-testid="input-shelter-email"
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-200">Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          placeholder="Enter your password"
                          disabled={loginMutation.isPending}
                          className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                          data-testid="input-shelter-password"
                        />
                      </FormControl>
                      <FormMessage className="text-red-400" />
                    </FormItem>
                  )}
                />

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-shelter-login"
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In to Dashboard"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 pt-6 border-t border-slate-700">
              <div className="text-center space-y-3">
                <p className="text-sm text-slate-400">
                  Don't have a shelter account?
                </p>
                <Link href="/signup?intended_role=shelter">
                  <Button 
                    variant="outline" 
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                    data-testid="link-shelter-signup"
                  >
                    Register Your Shelter
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400 text-center">
                Demo Account: shelter@happytails.org / password123
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 text-center">
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
            data-testid="link-back-to-main"
          >
            ← Back to Scout
          </button>
        </div>
      </div>
    </div>
  );
}
