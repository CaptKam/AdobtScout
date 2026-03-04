import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Heart,
  DollarSign,
  TrendingUp,
  Users,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Settings,
  Calendar,
  Target,
  Gift,
  AlertCircle,
  CheckCircle,
  Clock,
  Lock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { format } from "date-fns";
import type { FundraisingCampaign, Donation, ShelterPaymentSettings, Dog } from "@shared/schema";

interface DonationStats {
  totalRaised: number;
  totalDonations: number;
  last30Days: number;
  last30DaysCount: number;
  activeCampaigns: number;
  totalCampaigns: number;
  campaignGoalProgress: {
    goal: number;
    current: number;
  };
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function CampaignForm({ 
  campaign, 
  dogs,
  onSubmit, 
  onCancel 
}: { 
  campaign?: FundraisingCampaign; 
  dogs: Dog[];
  onSubmit: (data: any) => void; 
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: campaign?.title || "",
    description: campaign?.description || "",
    goalAmount: campaign ? campaign.goalAmount / 100 : 1000,
    campaignType: campaign?.campaignType || "general",
    dogId: campaign?.dogId || "",
    status: campaign?.status || "draft",
    isPublic: campaign?.isPublic ?? true,
    isFeatured: campaign?.isFeatured ?? false,
    startDate: campaign?.startDate ? format(new Date(campaign.startDate), "yyyy-MM-dd") : "",
    endDate: campaign?.endDate ? format(new Date(campaign.endDate), "yyyy-MM-dd") : "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      goalAmount: formData.goalAmount * 100,
      dogId: formData.dogId || null,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Campaign Title</Label>
        <Input
          id="title"
          data-testid="input-campaign-title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Help us save more dogs!"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          data-testid="input-campaign-description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Tell donors what their contribution will help accomplish..."
          rows={4}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="goalAmount">Goal Amount ($)</Label>
          <Input
            id="goalAmount"
            data-testid="input-campaign-goal"
            type="number"
            min="100"
            value={formData.goalAmount}
            onChange={(e) => setFormData({ ...formData, goalAmount: parseInt(e.target.value) || 0 })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="campaignType">Campaign Type</Label>
          <Select
            value={formData.campaignType}
            onValueChange={(value) => setFormData({ ...formData, campaignType: value })}
          >
            <SelectTrigger data-testid="select-campaign-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General Fund</SelectItem>
              <SelectItem value="medical">Medical Care</SelectItem>
              <SelectItem value="rescue">Rescue Operation</SelectItem>
              <SelectItem value="facility">Facility Improvement</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.campaignType === "medical" && (
        <div className="space-y-2">
          <Label htmlFor="dogId">Link to Dog (Optional)</Label>
          <Select
            value={formData.dogId}
            onValueChange={(value) => setFormData({ ...formData, dogId: value })}
          >
            <SelectTrigger data-testid="select-campaign-dog">
              <SelectValue placeholder="Select a dog" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No specific dog</SelectItem>
              {dogs.map((dog) => (
                <SelectItem key={dog.id} value={dog.id}>
                  {dog.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            data-testid="input-campaign-start-date"
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            data-testid="input-campaign-end-date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => setFormData({ ...formData, status: value })}
        >
          <SelectTrigger data-testid="select-campaign-status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="isPublic"
            checked={formData.isPublic}
            onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
          />
          <Label htmlFor="isPublic">Public Campaign</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="isFeatured"
            checked={formData.isFeatured}
            onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
          />
          <Label htmlFor="isFeatured">Featured</Label>
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onCancel} data-testid="button-campaign-cancel">
          Cancel
        </Button>
        <Button type="submit" data-testid="button-campaign-save">
          {campaign ? "Update Campaign" : "Create Campaign"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PaymentSettingsForm({
  settings,
  onSubmit,
  onCancel,
}: {
  settings: ShelterPaymentSettings | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    acceptsDonations: settings?.acceptsDonations ?? true,
    minimumDonation: settings?.minimumDonation ?? 5,
    suggestedAmounts: (settings?.suggestedAmounts as number[])?.join(", ") || "10, 25, 50, 100",
    showDonorNames: settings?.showDonorNames ?? true,
    showDonationAmounts: settings?.showDonationAmounts ?? false,
    thankYouMessage: settings?.thankYouMessage || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      suggestedAmounts: formData.suggestedAmounts
        .split(",")
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n)),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <Label className="text-base font-medium">Accept Donations</Label>
          <p className="text-sm text-muted-foreground">Enable donation collection</p>
        </div>
        <Switch
          checked={formData.acceptsDonations}
          onCheckedChange={(checked) => setFormData({ ...formData, acceptsDonations: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="minimumDonation">Minimum Donation ($)</Label>
        <Input
          id="minimumDonation"
          data-testid="input-min-donation"
          type="number"
          min="1"
          value={formData.minimumDonation}
          onChange={(e) => setFormData({ ...formData, minimumDonation: parseInt(e.target.value) || 5 })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="suggestedAmounts">Suggested Amounts (comma-separated)</Label>
        <Input
          id="suggestedAmounts"
          data-testid="input-suggested-amounts"
          value={formData.suggestedAmounts}
          onChange={(e) => setFormData({ ...formData, suggestedAmounts: e.target.value })}
          placeholder="10, 25, 50, 100"
        />
        <p className="text-xs text-muted-foreground">These amounts will be shown as quick-select buttons</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="thankYouMessage">Thank You Message</Label>
        <Textarea
          id="thankYouMessage"
          data-testid="input-thank-you-message"
          value={formData.thankYouMessage}
          onChange={(e) => setFormData({ ...formData, thankYouMessage: e.target.value })}
          placeholder="Thank you for your generous donation! Your support helps us save more lives."
          rows={3}
        />
      </div>

      <div className="space-y-3 p-4 border rounded-lg">
        <h4 className="font-medium">Privacy Settings</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="showDonorNames" className="font-normal">Show donor names publicly</Label>
          <Switch
            id="showDonorNames"
            checked={formData.showDonorNames}
            onCheckedChange={(checked) => setFormData({ ...formData, showDonorNames: checked })}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="showDonationAmounts" className="font-normal">Show donation amounts publicly</Label>
          <Switch
            id="showDonationAmounts"
            checked={formData.showDonationAmounts}
            onCheckedChange={(checked) => setFormData({ ...formData, showDonationAmounts: checked })}
          />
        </div>
      </div>

      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" data-testid="button-save-settings">
          Save Settings
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ShelterDonations() {
  const { toast } = useToast();
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();
  const [selectedTab, setSelectedTab] = useState("overview");
  
  const isDonationsEnabled = flagsLoading ? false : (featureFlags?.enabledFeatures?.includes('shelter_donations') ?? false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<FundraisingCampaign | null>(null);

  const { data: stats } = useQuery<DonationStats>({
    queryKey: ["/api/shelter/donation-stats"],
  });

  const { data: campaigns = [] } = useQuery<FundraisingCampaign[]>({
    queryKey: ["/api/shelter/campaigns"],
  });

  const { data: donations = [] } = useQuery<Donation[]>({
    queryKey: ["/api/shelter/donations"],
  });

  const { data: settings } = useQuery<ShelterPaymentSettings>({
    queryKey: ["/api/shelter/payment-settings"],
  });

  const { data: dogs = [] } = useQuery<Dog[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const { data: currentUser } = useQuery<{ id: string }>({
    queryKey: ["/api/me"],
  });

  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/shelter/campaigns", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/donation-stats"] });
      setShowCampaignDialog(false);
      toast({ title: "Campaign created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PUT", `/api/shelter/campaigns/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/donation-stats"] });
      setEditingCampaign(null);
      toast({ title: "Campaign updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update campaign", description: error.message, variant: "destructive" });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shelter/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/donation-stats"] });
      toast({ title: "Campaign deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete campaign", description: error.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", "/api/shelter/payment-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/payment-settings"] });
      setShowSettingsDialog(false);
      toast({ title: "Settings updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update settings", description: error.message, variant: "destructive" });
    },
  });

  const getCampaignStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      draft: { variant: "secondary", icon: Clock },
      active: { variant: "default", icon: CheckCircle },
      paused: { variant: "outline", icon: AlertCircle },
      completed: { variant: "secondary", icon: CheckCircle },
      cancelled: { variant: "destructive", icon: AlertCircle },
    };
    const config = variants[status] || variants.draft;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCampaignTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      general: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      medical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      rescue: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      facility: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      emergency: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return (
      <Badge variant="outline" className={colors[type] || colors.general}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const donationPageUrl = currentUser ? `${window.location.origin}/donate/${currentUser.id}` : "";

  const copyDonationLink = () => {
    navigator.clipboard.writeText(donationPageUrl);
    toast({ title: "Link copied to clipboard" });
  };

  return (
    
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-donations-title">Donations</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage fundraising campaigns and track donations</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)} data-testid="button-donation-settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-campaign">
                  <Plus className="w-4 h-4 mr-2" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Campaign</DialogTitle>
                  <DialogDescription>
                    Set up a new fundraising campaign for your shelter
                  </DialogDescription>
                </DialogHeader>
                <CampaignForm
                  dogs={dogs}
                  onSubmit={(data) => createCampaignMutation.mutate(data)}
                  onCancel={() => setShowCampaignDialog(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Raised</p>
                  <p className="text-xl font-bold" data-testid="text-total-raised">
                    {stats ? formatCurrency(stats.totalRaised) : "$0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last 30 Days</p>
                  <p className="text-xl font-bold" data-testid="text-30-day-total">
                    {stats ? formatCurrency(stats.last30Days) : "$0.00"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Donors</p>
                  <p className="text-xl font-bold" data-testid="text-total-donors">
                    {stats?.totalDonations || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Target className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Campaigns</p>
                  <p className="text-xl font-bold" data-testid="text-active-campaigns">
                    {stats?.activeCampaigns || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donation Link Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Your Donation Page</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Share this link with supporters to collect donations
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-donation-link">
                    {donationPageUrl}
                  </code>
                  <Button size="sm" variant="outline" onClick={copyDonationLink} data-testid="button-copy-link">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(donationPageUrl, "_blank")}
                    data-testid="button-open-donation-page"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Demo Mode Notice */}
        <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Demo Mode</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Stripe is not connected. Donations are simulated and no actual charges are made.
                  Connect Stripe to start accepting real payments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns" data-testid="tab-campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="donations" data-testid="tab-donations">Donations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Campaign Progress */}
            {campaigns.filter(c => c.status === 'active').length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Active Campaigns</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaigns
                    .filter(c => c.status === 'active')
                    .map((campaign) => {
                      const progress = campaign.goalAmount > 0
                        ? Math.round(((campaign.currentAmount || 0) / campaign.goalAmount) * 100)
                        : 0;
                      return (
                        <div key={campaign.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{campaign.title}</span>
                              {getCampaignTypeBadge(campaign.campaignType)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(campaign.currentAmount || 0)} / {formatCurrency(campaign.goalAmount)}
                            </span>
                          </div>
                          <Progress value={progress} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{campaign.donorCount || 0} donors</span>
                            <span>{progress}% of goal</span>
                          </div>
                        </div>
                      );
                    })}
                </CardContent>
              </Card>
            )}

            {/* Recent Donations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Donations</CardTitle>
              </CardHeader>
              <CardContent>
                {donations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No donations yet</p>
                    <p className="text-sm">Share your donation page to start collecting</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {donations.slice(0, 5).map((donation) => (
                      <div key={donation.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">
                            {donation.isAnonymous ? "Anonymous" : donation.donorName || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(donation.createdAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400">
                            +{formatCurrency(donation.amount)}
                          </p>
                          {donation.isTestDonation && (
                            <Badge variant="outline" className="text-xs">Test</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">All Campaigns</CardTitle>
                  <CardDescription>Manage your fundraising campaigns</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                {campaigns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No campaigns yet</p>
                    <Button className="mt-4" onClick={() => setShowCampaignDialog(true)}>
                      Create Your First Campaign
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {campaigns.map((campaign) => {
                      const progress = campaign.goalAmount > 0
                        ? Math.round(((campaign.currentAmount || 0) / campaign.goalAmount) * 100)
                        : 0;
                      return (
                        <Card key={campaign.id} className="overflow-hidden">
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h3 className="font-semibold">{campaign.title}</h3>
                                  {getCampaignStatusBadge(campaign.status)}
                                  {getCampaignTypeBadge(campaign.campaignType)}
                                  {campaign.isFeatured && (
                                    <Badge variant="secondary" className="gap-1">
                                      Featured
                                    </Badge>
                                  )}
                                </div>
                                {campaign.description && (
                                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {campaign.description}
                                  </p>
                                )}
                                <div className="space-y-2">
                                  <Progress value={progress} className="h-2" />
                                  <div className="flex justify-between text-sm">
                                    <span className="font-medium text-green-600 dark:text-green-400">
                                      {formatCurrency(campaign.currentAmount || 0)}
                                    </span>
                                    <span className="text-muted-foreground">
                                      of {formatCurrency(campaign.goalAmount)} ({progress}%)
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {campaign.donorCount || 0} donors
                                  </span>
                                  {campaign.startDate && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      Started {format(new Date(campaign.startDate), "MMM d")}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex sm:flex-col gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingCampaign(campaign)}
                                  data-testid={`button-edit-campaign-${campaign.id}`}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive hover:text-destructive"
                                      data-testid={`button-delete-campaign-${campaign.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete the campaign "{campaign.title}".
                                        This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="donations" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Donation History</CardTitle>
                <CardDescription>All donations received by your shelter</CardDescription>
              </CardHeader>
              <CardContent>
                {donations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Heart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No donations yet</p>
                    <p className="text-sm">Share your donation page to start collecting</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Donor</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Campaign</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donations.map((donation) => {
                          const campaign = campaigns.find(c => c.id === donation.campaignId);
                          return (
                            <TableRow key={donation.id}>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(donation.createdAt), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>
                                {donation.isAnonymous ? (
                                  <span className="text-muted-foreground italic">Anonymous</span>
                                ) : (
                                  <div>
                                    <p className="font-medium">{donation.donorName || "Unknown"}</p>
                                    {donation.donorEmail && (
                                      <p className="text-xs text-muted-foreground">{donation.donorEmail}</p>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(donation.amount)}
                              </TableCell>
                              <TableCell>
                                {campaign ? (
                                  <span className="text-sm">{campaign.title}</span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">General Fund</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={donation.paymentStatus === 'succeeded' ? "default" : "secondary"}
                                >
                                  {donation.paymentStatus}
                                </Badge>
                                {donation.isTestDonation && (
                                  <Badge variant="outline" className="ml-1 text-xs">Test</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Campaign Dialog */}
      <Dialog open={!!editingCampaign} onOpenChange={() => setEditingCampaign(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
            <DialogDescription>
              Update your fundraising campaign
            </DialogDescription>
          </DialogHeader>
          {editingCampaign && (
            <CampaignForm
              campaign={editingCampaign}
              dogs={dogs}
              onSubmit={(data) => updateCampaignMutation.mutate({ id: editingCampaign.id, data })}
              onCancel={() => setEditingCampaign(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Donation Settings</DialogTitle>
            <DialogDescription>
              Configure how donations are collected and displayed
            </DialogDescription>
          </DialogHeader>
          <PaymentSettingsForm
            settings={settings || null}
            onSubmit={(data) => updateSettingsMutation.mutate(data)}
            onCancel={() => setShowSettingsDialog(false)}
          />
        </DialogContent>
      </Dialog>
    
  );
}
