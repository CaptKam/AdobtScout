import { Card, CardContent } from "@/components/ui/card";
import { Heart, MapPin, Sparkles, ArrowRight } from "lucide-react";

export default function OnboardingRoleSelect() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-foreground font-medium">Welcome to Scout</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl mb-4">
            Let's Get Started
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your path to continue. Everyone needs to create an account for the best experience.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Card className="border-2 hover-elevate active-elevate-2 transition-all group cursor-pointer" data-testid="card-role-adopter">
            <a href="/login?intended_role=adopter">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">Looking to Adopt</h3>
                <p className="text-muted-foreground">
                  Find your perfect companion with AI-powered matching. You can also switch to rehoming mode later in your profile.
                </p>
                <div className="pt-2">
                  <span className="text-primary font-medium group-hover:underline inline-flex items-center">
                    Start Matching <ArrowRight className="ml-1 w-4 h-4" />
                  </span>
                </div>
              </CardContent>
            </a>
          </Card>

          <Card className="border-2 hover-elevate active-elevate-2 transition-all group cursor-pointer" data-testid="card-role-shelter">
            <a href="/login?intended_role=shelter">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <MapPin className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold">I'm a Shelter</h3>
                <p className="text-muted-foreground">
                  Post multiple dogs and manage adoption inquiries with our tools
                </p>
                <div className="pt-2">
                  <span className="text-primary font-medium group-hover:underline inline-flex items-center">
                    Sign In <ArrowRight className="ml-1 w-4 h-4" />
                  </span>
                </div>
              </CardContent>
            </a>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            By continuing, you agree to Scout's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
