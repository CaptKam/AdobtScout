import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  DollarSign,
  MapPin,
  CheckCircle,
  ArrowLeft,
  Users,
  Calendar,
  Target,
  Gift,
  AlertCircle,
  Dog,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { FundraisingCampaign } from "@shared/schema";

interface DonationPageData {
  shelter: {
    id: string;
    name: string;
    description: string | null;
    location: string;
  };
  settings: {
    acceptsDonations: boolean;
    minimumDonation: number;
    suggestedAmounts: number[];
    thankYouMessage: string | null;
    showDonorNames: boolean;
    showDonationAmounts: boolean;
  };
  campaigns: FundraisingCampaign[];
  recentDonors: Array<{
    name: string | null;
    amount: number | null;
    message: string | null;
    date: string;
  }>;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function DonationForm({
  shelterId,
  shelterName,
  settings,
  campaigns,
  onSuccess,
}: {
  shelterId: string;
  shelterName: string;
  settings: DonationPageData['settings'];
  campaigns: FundraisingCampaign[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [formData, setFormData] = useState({
    donorName: "",
    donorEmail: "",
    message: "",
    campaignId: "_general", // Use "_general" to represent general fund (no specific campaign)
    isAnonymous: false,
  });

  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  const donationMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/donate/${shelterId}`, data),
    onSuccess: () => {
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Donation failed",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = selectedAmount || (customAmount ? parseFloat(customAmount) * 100 : 0);
    
    if (amount < settings.minimumDonation * 100) {
      toast({
        title: "Invalid amount",
        description: `Minimum donation is $${settings.minimumDonation}`,
        variant: "destructive",
      });
      return;
    }

    donationMutation.mutate({
      amount: Math.round(amount),
      donorName: formData.donorName,
      donorEmail: formData.donorEmail,
      message: formData.message,
      campaignId: formData.campaignId === "_general" ? null : formData.campaignId,
      isAnonymous: formData.isAnonymous,
    });
  };

  const suggestedAmounts = settings.suggestedAmounts || [10, 25, 50, 100];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Campaign Selection */}
      {activeCampaigns.length > 0 && (
        <div className="space-y-2">
          <Label>Support a Campaign (Optional)</Label>
          <Select
            value={formData.campaignId}
            onValueChange={(value) => setFormData({ ...formData, campaignId: value })}
          >
            <SelectTrigger data-testid="select-campaign">
              <SelectValue placeholder="General Fund" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_general">General Fund</SelectItem>
              {activeCampaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Amount Selection */}
      <div className="space-y-3">
        <Label>Donation Amount</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {suggestedAmounts.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant={selectedAmount === amount * 100 ? "default" : "outline"}
              className="h-12"
              onClick={() => {
                setSelectedAmount(amount * 100);
                setCustomAmount("");
              }}
              data-testid={`button-amount-${amount}`}
            >
              ${amount}
            </Button>
          ))}
        </div>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Custom amount"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              setSelectedAmount(null);
            }}
            className="pl-9"
            min={settings.minimumDonation}
            data-testid="input-custom-amount"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Minimum donation: ${settings.minimumDonation}
        </p>
      </div>

      {/* Donor Info */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="donorName">Your Name</Label>
          <Input
            id="donorName"
            value={formData.donorName}
            onChange={(e) => setFormData({ ...formData, donorName: e.target.value })}
            placeholder="John Doe"
            disabled={formData.isAnonymous}
            required={!formData.isAnonymous}
            data-testid="input-donor-name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="donorEmail">Email Address</Label>
          <Input
            id="donorEmail"
            type="email"
            value={formData.donorEmail}
            onChange={(e) => setFormData({ ...formData, donorEmail: e.target.value })}
            placeholder="john@example.com"
            required
            data-testid="input-donor-email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message (Optional)</Label>
          <Textarea
            id="message"
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Leave a message of support..."
            rows={3}
            data-testid="input-donor-message"
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="anonymous"
            checked={formData.isAnonymous}
            onCheckedChange={(checked) => setFormData({ ...formData, isAnonymous: checked })}
          />
          <Label htmlFor="anonymous" className="font-normal">Donate anonymously</Label>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full h-12"
        disabled={donationMutation.isPending || (!selectedAmount && !customAmount)}
        data-testid="button-donate-submit"
      >
        {donationMutation.isPending ? (
          "Processing..."
        ) : (
          <>
            <Heart className="w-4 h-4 mr-2" />
            Donate {selectedAmount ? formatCurrency(selectedAmount) : customAmount ? `$${customAmount}` : ""}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Demo mode - no actual charges will be made
      </p>
    </form>
  );
}

function ThankYouScreen({
  shelterName,
  thankYouMessage,
  onDonateAgain,
}: {
  shelterName: string;
  thankYouMessage: string | null;
  onDonateAgain: () => void;
}) {
  return (
    <div className="text-center py-8 space-y-6">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
        <p className="text-muted-foreground">
          {thankYouMessage || `Your donation to ${shelterName} will help save more lives. Thank you for your generosity!`}
        </p>
      </div>
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div className="text-left">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Demo Mode</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              This was a simulated donation. No actual payment was processed.
            </p>
          </div>
        </div>
      </div>
      <Button variant="outline" onClick={onDonateAgain} data-testid="button-donate-again">
        Make Another Donation
      </Button>
    </div>
  );
}

export default function DonatePage() {
  const { shelterId } = useParams<{ shelterId: string }>();
  const [showThankYou, setShowThankYou] = useState(false);

  const { data, isLoading, error } = useQuery<DonationPageData>({
    queryKey: ["/api/donate", shelterId],
    enabled: !!shelterId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-background p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-32 w-full mb-4" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-full mb-4" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-bold mb-2">Shelter Not Found</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't find this shelter's donation page.
            </p>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data.settings.acceptsDonations) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-background p-4 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Donations Paused</h2>
            <p className="text-muted-foreground">
              {data.shelter.name} is not currently accepting online donations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeCampaigns = data.campaigns.filter(c => c.status === 'active');

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/20 dark:to-background">
      {/* Header */}
      <div className="bg-primary/10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center shadow-lg">
              <Dog className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-shelter-name">{data.shelter.name}</h1>
              {data.shelter.location && (
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {data.shelter.location}
                </p>
              )}
            </div>
          </div>
          {data.shelter.description && (
            <p className="mt-4 text-muted-foreground">{data.shelter.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Donation Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Make a Donation
              </CardTitle>
              <CardDescription>
                Support {data.shelter.name} and help save more lives
              </CardDescription>
            </CardHeader>
            <CardContent>
              {showThankYou ? (
                <ThankYouScreen
                  shelterName={data.shelter.name}
                  thankYouMessage={data.settings.thankYouMessage}
                  onDonateAgain={() => setShowThankYou(false)}
                />
              ) : (
                <DonationForm
                  shelterId={shelterId!}
                  shelterName={data.shelter.name}
                  settings={data.settings}
                  campaigns={data.campaigns}
                  onSuccess={() => setShowThankYou(true)}
                />
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Active Campaigns */}
            {activeCampaigns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Active Campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeCampaigns.map((campaign) => {
                    const progress = campaign.goalAmount > 0
                      ? Math.round(((campaign.currentAmount || 0) / campaign.goalAmount) * 100)
                      : 0;
                    return (
                      <div key={campaign.id} className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{campaign.title}</h4>
                            {campaign.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {campaign.description}
                              </p>
                            )}
                          </div>
                          {campaign.isFeatured && (
                            <Badge variant="secondary" className="text-xs">Featured</Badge>
                          )}
                        </div>
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(campaign.currentAmount || 0)} raised</span>
                          <span>{progress}% of {formatCurrency(campaign.goalAmount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Recent Donors */}
            {data.recentDonors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recent Supporters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.recentDonors.slice(0, 5).map((donor, index) => (
                      <div key={index} className="flex items-center gap-3 py-2 border-b last:border-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <Heart className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{donor.name || "Anonymous"}</p>
                          {donor.message && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              "{donor.message}"
                            </p>
                          )}
                        </div>
                        {donor.amount && (
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {formatCurrency(donor.amount)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Why Donate */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" />
                  Your Impact
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Provide food, shelter, and medical care</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Support rescue operations and transport</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Help dogs find their forever homes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                    <span>Fund training and behavioral support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by Scout - AI-Powered Dog Adoption Platform</p>
        </div>
      </div>
    </div>
  );
}
