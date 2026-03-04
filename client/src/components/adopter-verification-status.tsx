import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface AdopterVerificationStatusProps {
  embedded?: boolean;
}

export function AdopterVerificationStatus({ embedded = false }: AdopterVerificationStatusProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPetPolicyForm, setShowPetPolicyForm] = useState(false);
  const [formData, setFormData] = useState({
    verificationMethod: "self_attestation",
    landlordName: "",
    landlordPhone: "",
    landlordEmail: "",
  });

  const { data: verification, isLoading } = useQuery({
    queryKey: ["/api/adopter-verification"],
    queryFn: async () => {
      const res = await fetch("/api/adopter-verification");
      return res.json();
    },
  });

  const petPolicyMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/adopter-verification/pet-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update pet policy");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Pet policy verification submitted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/adopter-verification"] });
      setShowPetPolicyForm(false);
      setFormData({
        verificationMethod: "self_attestation",
        landlordName: "",
        landlordPhone: "",
        landlordEmail: "",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit pet policy verification",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-2">Loading verification status...</div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "passed":
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const content = (
    <div className="space-y-3" data-testid="adopter-verification-content">
      {/* Header with ready badge - only show in embedded mode */}
      {embedded && verification?.isReadyToAdopt && (
        <div className="flex justify-end">
          <Badge
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1.5"
            data-testid="badge-ready-to-adopt"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Ready to Adopt
          </Badge>
        </div>
      )}

      {/* Background Check Status */}
      <div className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2.5">
          {getStatusIcon(verification?.backgroundCheckStatus)}
          <div>
            <div className="text-sm font-medium">Background Check</div>
            <div className="text-xs text-muted-foreground capitalize">
              {verification?.backgroundCheckStatus || "Not started"}
            </div>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {verification?.backgroundCheckCompletedAt
            ? new Date(verification.backgroundCheckCompletedAt).toLocaleDateString()
            : ""}
        </span>
      </div>

      {/* Pet Policy Verification */}
      <div className="flex items-center justify-between p-3 bg-muted/50 dark:bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2.5">
          {verification?.petPolicyVerified ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-gray-400" />
          )}
          <div>
            <div className="text-sm font-medium">Pet Policy</div>
            <div className="text-xs text-muted-foreground">
              {verification?.petPolicyVerified
                ? `Verified via ${verification.petPolicyVerificationMethod?.replace('_', ' ')}`
                : "Not yet verified"}
            </div>
          </div>
        </div>
        {verification?.petPolicyVerifiedAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(verification.petPolicyVerifiedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Pet Policy Form */}
      {!verification?.petPolicyVerified && (
        <div>
          {!showPetPolicyForm ? (
            <Button
              onClick={() => setShowPetPolicyForm(true)}
              variant="outline"
              size="sm"
              className="w-full"
              data-testid="button-verify-pet-policy"
            >
              Verify Pet Policy
            </Button>
          ) : (
            <div className="space-y-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
              <div>
                <label className="text-xs font-medium">Verification Method</label>
                <select
                  value={formData.verificationMethod}
                  onChange={(e) =>
                    setFormData({ ...formData, verificationMethod: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                  data-testid="select-verification-method"
                >
                  <option value="self_attestation">Self Attestation</option>
                  <option value="landlord_letter">Landlord Letter</option>
                  <option value="lease_copy">Lease Copy</option>
                </select>
              </div>

              {formData.verificationMethod !== "self_attestation" && (
                <>
                  <div>
                    <label className="text-xs font-medium">Landlord Name</label>
                    <input
                      type="text"
                      value={formData.landlordName}
                      onChange={(e) =>
                        setFormData({ ...formData, landlordName: e.target.value })
                      }
                      placeholder="John Smith"
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                      data-testid="input-landlord-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Landlord Phone</label>
                    <input
                      type="tel"
                      value={formData.landlordPhone}
                      onChange={(e) =>
                        setFormData({ ...formData, landlordPhone: e.target.value })
                      }
                      placeholder="(555) 123-4567"
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                      data-testid="input-landlord-phone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Landlord Email</label>
                    <input
                      type="email"
                      value={formData.landlordEmail}
                      onChange={(e) =>
                        setFormData({ ...formData, landlordEmail: e.target.value })
                      }
                      placeholder="landlord@example.com"
                      className="w-full mt-1 px-3 py-2 border rounded-md text-sm bg-background"
                      data-testid="input-landlord-email"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    petPolicyMutation.mutate(formData as any);
                  }}
                  disabled={petPolicyMutation.isPending}
                  size="sm"
                  className="flex-1"
                  data-testid="button-submit-pet-policy"
                >
                  Submit
                </Button>
                <Button
                  onClick={() => setShowPetPolicyForm(false)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  data-testid="button-cancel-pet-policy"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Score - compact for embedded */}
      <div className="flex items-center justify-between p-3 bg-primary/5 dark:bg-primary/10 rounded-lg">
        <div className="text-sm font-medium">Verification Score</div>
        <span className="text-lg font-bold text-primary">
          {verification?.verificationScore || 0}
        </span>
      </div>
    </div>
  );

  // Embedded mode: return just the content without Card wrapper
  if (embedded) {
    return content;
  }

  // Standalone mode: wrap in Card
  return (
    <div className="space-y-4" data-testid="adopter-verification-status">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Verification Status</h3>
          {verification?.isReadyToAdopt && (
            <Badge
              className="bg-green-100 text-green-800 flex items-center gap-2"
              data-testid="badge-ready-to-adopt"
            >
              <ShieldCheck className="w-4 h-4" />
              Ready to Adopt
            </Badge>
          )}
        </div>
        {content}
      </Card>
    </div>
  );
}
