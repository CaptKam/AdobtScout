import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShelterCheckbox } from "@/components/ui/shelter-checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ShoppingCart, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  FileText, 
  User, 
  Dog,
  CreditCard,
  Truck,
  Package,
  Timer,
  ArrowRight,
  Sparkles,
  PartyPopper
} from "lucide-react";
import { format } from "date-fns";

interface PendingCheckout {
  journey: any;
  dog: any;
  adopter: any;
  profile: any;
  checkout: any | null;
}

interface Checkout {
  id: string;
  status: string;
  adoptionFee: number;
  paymentStatus: string;
  contractSigned: boolean;
  microchipTransferred: boolean;
  suppliesProvided: any;
  startedAt: string;
  completedAt: string;
  processingTimeSeconds: number;
  dog: any;
  adopter: any;
}

export default function ShelterCheckout() {
  const { toast } = useToast();
  const [selectedCheckout, setSelectedCheckout] = useState<PendingCheckout | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<Checkout | null>(null);
  const [checkoutStep, setCheckoutStep] = useState(0);
  const [checkoutTimer, setCheckoutTimer] = useState(0);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  const { data: pendingCheckouts = [], isLoading: pendingLoading } = useQuery<PendingCheckout[]>({
    queryKey: ["/api/shelter/checkout/pending"],
  });

  const { data: completedCheckouts = [] } = useQuery<Checkout[]>({
    queryKey: ["/api/shelter/checkouts"],
  });

  const startCheckoutMutation = useMutation({
    mutationFn: (data: { journeyId: string; dogId: string; adopterId: string; adoptionFee: number }) =>
      apiRequest("POST", "/api/shelter/checkout/start", data),
    onSuccess: (data) => {
      setActiveCheckout(data as Checkout);
      setCheckoutStep(1);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/checkout/pending"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateCheckoutMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/shelter/checkout/${id}`, data),
    onSuccess: (data) => {
      setActiveCheckout(data as Checkout);
    },
  });

  const completeCheckoutMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("POST", `/api/shelter/checkout/${id}/complete`),
    onSuccess: () => {
      setShowCompletionDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/checkout/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/checkouts"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeCheckout && checkoutStep > 0 && checkoutStep < 5) {
      interval = setInterval(() => {
        setCheckoutTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeCheckout, checkoutStep]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCheckout = (checkout: PendingCheckout) => {
    setSelectedCheckout(checkout);
    setCheckoutTimer(0);
    startCheckoutMutation.mutate({
      journeyId: checkout.journey.id,
      dogId: checkout.dog.id,
      adopterId: checkout.adopter.id,
      adoptionFee: 150,
    });
  };

  const handleNextStep = () => {
    if (checkoutStep < 4) {
      setCheckoutStep(checkoutStep + 1);
    } else if (activeCheckout) {
      completeCheckoutMutation.mutate(activeCheckout.id);
    }
  };

  const handleCloseCompletion = () => {
    setShowCompletionDialog(false);
    setSelectedCheckout(null);
    setActiveCheckout(null);
    setCheckoutStep(0);
    setCheckoutTimer(0);
  };

  const checkoutSteps = [
    { label: "Start", icon: ShoppingCart },
    { label: "Payment", icon: CreditCard },
    { label: "Contract", icon: FileText },
    { label: "Microchip", icon: Truck },
    { label: "Complete", icon: CheckCircle },
  ];

  const recentCompleted = completedCheckouts
    .filter(c => c.status === 'completed')
    .slice(0, 5);

  const avgProcessingTime = recentCompleted.length > 0
    ? Math.round(recentCompleted.reduce((sum, c) => sum + (c.processingTimeSeconds || 0), 0) / recentCompleted.length)
    : 0;

  return (
    
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Mobile Checkout
            </h1>
            <p className="text-muted-foreground">Fast adoption processing in under 3 minutes</p>
          </div>
          {avgProcessingTime > 0 && (
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200">
              <CardContent className="p-3 flex items-center gap-2">
                <Timer className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Avg: {formatTime(avgProcessingTime)}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Ready for Checkout ({pendingCheckouts.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Completed Today
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            {activeCheckout && selectedCheckout ? (
              <Card>
                <CardHeader className="border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedCheckout.dog?.photos?.[0]}
                        alt={selectedCheckout.dog?.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedCheckout.dog?.name}
                          <Badge variant="outline">Adoption</Badge>
                        </CardTitle>
                        <CardDescription>
                          Adopter: {selectedCheckout.adopter?.firstName} {selectedCheckout.adopter?.lastName}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{formatTime(checkoutTimer)}</div>
                        <div className="text-xs text-muted-foreground">Elapsed Time</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-4">
                    {checkoutSteps.map((step, i) => (
                      <div key={i} className="flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            i < checkoutStep
                              ? "bg-green-500 text-white"
                              : i === checkoutStep
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <step.icon className="w-4 h-4" />
                        </div>
                        {i < checkoutSteps.length - 1 && (
                          <div
                            className={`w-12 h-1 mx-1 ${
                              i < checkoutStep ? "bg-green-500" : "bg-muted"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="p-6">
                  {checkoutStep === 1 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-primary" />
                        Payment Collection
                      </h3>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Adoption Fee</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-2xl font-bold">${activeCheckout.adoptionFee || 150}</span>
                          </div>
                        </div>
                        
                        <div>
                          <Label>Payment Method</Label>
                          <Select
                            onValueChange={(value) =>
                              updateCheckoutMutation.mutate({
                                id: activeCheckout.id,
                                data: { paymentMethod: value, paymentStatus: 'paid' },
                              })
                            }
                          >
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="card">Credit/Debit Card</SelectItem>
                              <SelectItem value="check">Check</SelectItem>
                              <SelectItem value="waived">Fee Waived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ShelterCheckbox id="fee-waived" />
                        <Label htmlFor="fee-waived">Waive adoption fee</Label>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 2 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Adoption Contract
                      </h3>
                      
                      <div className="bg-muted p-4 rounded-lg max-h-48 overflow-y-auto text-sm">
                        <p className="font-semibold mb-2">ADOPTION AGREEMENT</p>
                        <p>I agree to provide proper care for {selectedCheckout.dog?.name}, including:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Adequate food, water, and shelter</li>
                          <li>Regular veterinary care and vaccinations</li>
                          <li>A safe and loving environment</li>
                          <li>Contact the shelter if unable to keep the pet</li>
                        </ul>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ShelterCheckbox
                          id="contract-signed"
                          onCheckedChange={(checked) =>
                            updateCheckoutMutation.mutate({
                              id: activeCheckout.id,
                              data: { contractSigned: !!checked, contractSignedAt: new Date() },
                            })
                          }
                        />
                        <Label htmlFor="contract-signed">Adopter has signed the contract</Label>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 3 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Truck className="w-5 h-5 text-primary" />
                        Microchip Transfer
                      </h3>
                      
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>Microchip Number</Label>
                          <Input
                            placeholder="Enter microchip number"
                            onChange={(e) =>
                              updateCheckoutMutation.mutate({
                                id: activeCheckout.id,
                                data: { microchipNumber: e.target.value },
                              })
                            }
                            data-testid="input-microchip-number"
                          />
                        </div>
                        <div>
                          <Label>Registry</Label>
                          <Select
                            onValueChange={(value) =>
                              updateCheckoutMutation.mutate({
                                id: activeCheckout.id,
                                data: { microchipRegistry: value },
                              })
                            }
                          >
                            <SelectTrigger data-testid="select-microchip-registry">
                              <SelectValue placeholder="Select registry" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="akc_reunite">AKC Reunite</SelectItem>
                              <SelectItem value="homeagain">HomeAgain</SelectItem>
                              <SelectItem value="petlink">PetLink</SelectItem>
                              <SelectItem value="24petwatch">24PetWatch</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <ShelterCheckbox
                          id="microchip-transferred"
                          onCheckedChange={(checked) =>
                            updateCheckoutMutation.mutate({
                              id: activeCheckout.id,
                              data: { microchipTransferred: !!checked },
                            })
                          }
                        />
                        <Label htmlFor="microchip-transferred">Microchip ownership transferred</Label>
                      </div>
                    </div>
                  )}

                  {checkoutStep === 4 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Supplies & Go-Home Kit
                      </h3>
                      
                      <div className="grid gap-3 md:grid-cols-2">
                        {['Food sample', 'Leash', 'Collar', 'ID tag', 'Vaccination records', 'Care guide'].map((item) => (
                          <div key={item} className="flex items-center gap-2">
                            <ShelterCheckbox id={`supply-${item}`} />
                            <Label htmlFor={`supply-${item}`}>{item}</Label>
                          </div>
                        ))}
                      </div>
                      
                      <div>
                        <Label>Additional Notes</Label>
                        <Textarea
                          placeholder="Any special instructions for the adopter..."
                          className="mt-1"
                          data-testid="textarea-checkout-notes"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="border-t pt-4">
                  <div className="flex justify-between w-full">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActiveCheckout(null);
                        setSelectedCheckout(null);
                        setCheckoutStep(0);
                      }}
                      data-testid="button-cancel-checkout"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleNextStep}
                      className="gap-2"
                      disabled={completeCheckoutMutation.isPending}
                      data-testid="button-next-step"
                    >
                      {checkoutStep === 4 ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Complete Adoption
                        </>
                      ) : (
                        <>
                          Next Step
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ) : pendingLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : pendingCheckouts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">All caught up!</h3>
                  <p className="text-muted-foreground">No pending adoptions ready for checkout</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingCheckouts.map((checkout) => (
                  <Card key={checkout.journey.id} className="hover-elevate" data-testid={`card-pending-checkout-${checkout.journey.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={checkout.dog?.photos?.[0]}
                          alt={checkout.dog?.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold">{checkout.dog?.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {checkout.adopter?.firstName} {checkout.adopter?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Approved: {format(new Date(checkout.journey.approvedAt), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        className="w-full mt-4 gap-2"
                        onClick={() => handleStartCheckout(checkout)}
                        disabled={startCheckoutMutation.isPending}
                        data-testid={`button-start-checkout-${checkout.journey.id}`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Start Checkout
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-4">
            {recentCompleted.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No adoptions completed today</h3>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {recentCompleted.map((checkout) => (
                  <Card key={checkout.id} data-testid={`card-completed-checkout-${checkout.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">{checkout.dog?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {checkout.adopter?.firstName} {checkout.adopter?.lastName}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatTime(checkout.processingTimeSeconds)}</p>
                        <p className="text-xs text-muted-foreground">Processing Time</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="text-center">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <PartyPopper className="w-8 h-8 text-green-600" />
            </div>
            <DialogTitle className="text-2xl">Adoption Complete!</DialogTitle>
            <DialogDescription>
              {selectedCheckout?.dog?.name} has found their forever home with{' '}
              {selectedCheckout?.adopter?.firstName}!
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Timer className="w-5 h-5" />
              <span className="text-xl font-bold">
                Completed in {formatTime(checkoutTimer)}
              </span>
            </div>
            {checkoutTimer < 180 && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                Under 3 minutes - Great job!
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleCloseCompletion} className="w-full" data-testid="button-close-completion">
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
  );
}