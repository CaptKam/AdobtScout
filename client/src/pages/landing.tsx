import { SafeLink } from "@/components/safe-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, Sparkles, ArrowRight, MapPin, Zap, MessageSquare, CheckCircle, Star } from "lucide-react";
import heroImage from "@assets/stock_images/happy_woman_hugging__5221f9a5.jpg";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/50 to-black/20 backdrop-blur-xl border-b border-white/5 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-2">
          <SafeLink href="/">
            <div className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white" />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white">Scout</span>
            </div>
          </SafeLink>

          <div className="flex items-center gap-2 sm:gap-4">
            <SafeLink href="/login">
              <Button variant="outline" className="text-white border-white/50 bg-white/10 hover:bg-white/25 font-semibold transition-all shadow-md text-sm sm:text-base px-3 sm:px-4" data-testid="button-header-sign-in">
                Sign In
              </Button>
            </SafeLink>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="min-h-screen flex items-center justify-center relative pt-20 pb-16">
        {/* Background Image with Dark Wash */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Happy person with their adopted dog"
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/80" />
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-12">
          {/* AI Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 mb-8 sm:mb-10 animate-slideUp">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="text-sm sm:text-base text-white font-semibold">AI-Powered Matching</span>
          </div>

          {/* Headline */}
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl lg:text-8xl text-white mb-6 sm:mb-10 leading-[1.1] animate-slideUp" style={{ animationDelay: "0.1s" }}>
            Every dog deserves
            <br />
            <span className="text-primary">a loving home</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-2xl md:text-3xl text-white/95 mb-10 sm:mb-14 max-w-3xl mx-auto leading-relaxed font-light animate-slideUp" style={{ animationDelay: "0.2s" }}>
            Scout helps you find a dog that truly fits your life — not just your lifestyle.
          </p>

          {/* CTAs */}
          <div className="flex flex-col gap-4 sm:gap-5 sm:flex-row justify-center items-stretch sm:items-center mb-10 sm:mb-12 animate-slideUp" style={{ animationDelay: "0.3s" }}>
            <SafeLink href="/signup" className="block w-full sm:w-auto">
              <Button 
                className="w-full sm:w-auto text-base sm:text-xl px-8 sm:px-16 py-4 sm:py-7 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl hover:shadow-2xl transition-all font-semibold"
                data-testid="button-start-matching"
              >
                Start Matching
                <Heart className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
              </Button>
            </SafeLink>
            <SafeLink href="/login" className="block w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto text-base sm:text-xl px-8 sm:px-14 py-4 sm:py-7 text-white border-2 border-white/40 bg-white/10 backdrop-blur-md hover:bg-white/20 font-semibold"
                data-testid="button-sign-in-hero"
              >
                Sign In
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </SafeLink>
          </div>

          {/* Subtext */}
          <p className="text-sm sm:text-base text-white/75 mb-5 animate-slideUp" style={{ animationDelay: "0.4s" }}>
            Free to join • AI-powered matching • Find your perfect companion
          </p>

          {/* Sign In Link */}
          <div className="animate-slideUp" style={{ animationDelay: "0.5s" }}>
            <p className="text-sm sm:text-base text-white/85">
              Already have an account?{" "}
              <a 
                href="/login" 
                className="text-primary hover:text-primary/80 underline font-semibold"
                data-testid="link-sign-in"
              >
                Sign In
              </a>
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
            <ArrowRight className="w-6 h-6 text-white/50 rotate-90" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">Features</Badge>
            <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
              Find your perfect match
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Scout uses advanced AI to understand both you and each dog, creating matches that last a lifetime
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: AI Matching */}
            <Card className="border-0 bg-gradient-to-br from-white/95 to-white/80 dark:from-slate-800/95 dark:to-slate-800/80 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
              <CardContent className="pt-10 pb-8 text-center relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">AI Compatibility</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our AI analyzes your lifestyle, home, and preferences to calculate a personalized compatibility score for every dog
                </p>
              </CardContent>
            </Card>

            {/* Feature 2: Swipe Discovery */}
            <Card className="border-0 bg-gradient-to-br from-white/95 to-white/80 dark:from-slate-800/95 dark:to-slate-800/80 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
              <CardContent className="pt-10 pb-8 text-center relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Heart className="w-12 h-12 text-primary fill-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Swipe Discovery</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Browse dogs with an intuitive, Tinder-style interface. Swipe right on dogs you love, left to pass
                </p>
              </CardContent>
            </Card>

            {/* Feature 3: Local Search */}
            <Card className="border-0 bg-gradient-to-br from-white/95 to-white/80 dark:from-slate-800/95 dark:to-slate-800/80 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 hover:opacity-100 transition-opacity" />
              <CardContent className="pt-10 pb-8 text-center relative z-10">
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <MapPin className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Local Search</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Find adoptable dogs near you with our interactive map. Filter by distance and see shelters in your area
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">How It Works</Badge>
            <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
              Three simple steps to adoption
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We've made finding your perfect companion as easy as 1-2-3
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line (desktop only) */}
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-border" style={{ top: "3rem" }} />

            {/* Step 1 */}
            <div className="relative text-center">
              <div className="w-24 h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg relative z-10">
                1
              </div>
              <h3 className="text-2xl font-bold mb-3">Tell us about you</h3>
              <p className="text-muted-foreground leading-relaxed">
                Answer a quick 11-question survey about your home, lifestyle, and what you're looking for in a dog
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="w-24 h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg relative z-10">
                2
              </div>
              <h3 className="text-2xl font-bold mb-3">Discover matches</h3>
              <p className="text-muted-foreground leading-relaxed">
                Swipe through AI-matched dogs near you. Each comes with a compatibility score and detailed profile
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative text-center">
              <div className="w-24 h-24 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-bold shadow-lg relative z-10">
                3
              </div>
              <h3 className="text-2xl font-bold mb-3">Meet & adopt</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connect with shelters directly through Scout. Schedule visits and find your forever friend
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <SafeLink href="/onboarding">
              <Button size="lg" className="text-lg px-8 py-6" data-testid="button-get-started-how">
                Get Started Now
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </SafeLink>
          </div>
        </div>
      </section>

      {/* Scout AI Preview Section */}
      <section className="py-24 px-6 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">Scout AI</Badge>
            <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
              Your personal adoption assistant
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Chat with Scout AI to get personalized recommendations and answers to all your adoption questions
            </p>
          </div>

          <Card className="border-2 max-w-3xl mx-auto">
            <CardContent className="p-6">
              {/* Chat Preview */}
              <div className="space-y-4">
                {/* User message */}
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                    <p className="text-sm">I'm looking for a medium-sized dog that's good with kids. Any suggestions?</p>
                  </div>
                </div>

                {/* Scout AI response */}
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                    <p className="text-sm mb-3">
                      Based on your profile, I found 3 wonderful dogs that would be perfect for your family! Here's my top recommendation:
                    </p>
                    <Card className="border">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg flex items-center justify-center">
                            🐕
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold">Luna, 3</h4>
                            <p className="text-xs text-muted-foreground">Golden Retriever Mix • 45 lbs</p>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            <Heart className="w-3 h-3 mr-1 fill-current" />
                            94%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Luna is gentle, patient, and loves children. Her moderate energy matches your active lifestyle perfectly.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Quick replies */}
                <div className="flex gap-2 flex-wrap pl-13">
                  <Button variant="outline" size="sm" className="text-xs">
                    Tell me more about Luna
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    Show other matches
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <SafeLink href="/messages">
              <Button variant="outline" size="lg" data-testid="button-chat-scout">
                <MessageSquare className="mr-2 w-5 h-5" />
                Chat with Scout AI
              </Button>
            </SafeLink>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4">Success Stories</Badge>
            <h2 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
              Thousands of happy matches
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join the growing Scout community and find your perfect companion
            </p>
          </div>

          {/* Stats */}
          <div className="grid sm:grid-cols-3 gap-8 mb-16">
            <Card className="text-center border-0 card-premium">
              <CardContent className="pt-8 pb-6">
                <div className="text-5xl font-bold text-primary mb-2 animate-fadeInScale">5,000+</div>
                <p className="text-muted-foreground font-medium">Successful Adoptions</p>
              </CardContent>
            </Card>
            <Card className="text-center border-0 card-premium">
              <CardContent className="pt-8 pb-6">
                <div className="text-5xl font-bold text-primary mb-2 animate-fadeInScale" style={{ animationDelay: "0.1s" }}>94%</div>
                <p className="text-muted-foreground font-medium">Match Success Rate</p>
              </CardContent>
            </Card>
            <Card className="text-center border-0 card-premium">
              <CardContent className="pt-8 pb-6">
                <div className="text-5xl font-bold text-primary mb-2 animate-fadeInScale" style={{ animationDelay: "0.2s" }}>500+</div>
                <p className="text-muted-foreground font-medium">Partner Shelters</p>
              </CardContent>
            </Card>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  "Scout's AI matching was incredible! We found Max within days, and he's been the perfect addition to our family. The compatibility score was spot-on."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-xl">
                    👩
                  </div>
                  <div>
                    <div className="font-semibold">Sarah M.</div>
                    <div className="text-sm text-muted-foreground">Adopted Max (Golden Retriever)</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 pb-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4 leading-relaxed">
                  "As a first-time dog owner, I was nervous. Scout AI helped me understand what to expect and matched me with Luna, who's patient and perfect for beginners."
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-xl">
                    👨
                  </div>
                  <div>
                    <div className="font-semibold">James K.</div>
                    <div className="text-sm text-muted-foreground">Adopted Luna (Labrador Mix)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-primary text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4 sm:mb-6">
            Ready to meet your perfect companion?
          </h2>
          <p className="text-base sm:text-xl mb-6 sm:mb-8 opacity-90">
            Start your journey today — create your free account in seconds
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center">
            <SafeLink href="/onboarding" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                variant="outline"
                className="w-full sm:w-auto text-base sm:text-lg px-8 sm:px-12 py-5 sm:py-6 bg-white text-primary hover:bg-white/90 border-0"
                data-testid="button-final-cta"
              >
                Start Matching Now
                <Heart className="ml-2 w-5 h-5" />
              </Button>
            </SafeLink>
            <SafeLink href="/login" className="w-full sm:w-auto">
              <Button 
                size="lg" 
                variant="ghost"
                className="w-full sm:w-auto text-base sm:text-lg px-8 py-5 sm:py-6 text-white hover:bg-white/10"
                data-testid="button-sign-in-final"
              >
                Sign In
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </SafeLink>
          </div>
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm opacity-75">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Free forever</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>AI-powered matching</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>500+ shelters</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}