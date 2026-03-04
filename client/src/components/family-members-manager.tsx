import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Plus, Users, Upload, X, Sparkles, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FamilyMember } from "@shared/schema";

interface PersonAnalysisResult {
  ageGroup: string;
  estimatedAge: string;
  confidence: string;
  observations: string;
}

export function FamilyMembersManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newMember, setNewMember] = useState({ name: "", relation: "child", ageGroup: "", photo: "" });
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PersonAnalysisResult | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string>("");

  const { data: members = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
  });

  const addMutation = useMutation({
    mutationFn: async (member: typeof newMember) => {
      return apiRequest("POST", "/api/family-members", member);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      setNewMember({ name: "", relation: "child", ageGroup: "", photo: "" });
      setAnalysisResult(null);
      setPendingBase64("");
      toast({ title: "Family member added" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/family-members/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family-members"] });
      toast({ title: "Family member removed" });
    },
  });

  const analyzePersonPhoto = async (base64Data: string) => {
    setAnalyzing(true);
    try {
      const response = await fetch("/api/analyze/person-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageBase64: base64Data }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Analysis failed");
      }

      const data = await response.json();
      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis);
        
        // Map AI age groups to form options for children
        const ageGroupMap: Record<string, string> = {
          infant: "infant",
          toddler: "toddler",
          child: "child",
          teen: "teen",
        };
        
        // Auto-set age group if this is a child relation
        if (newMember.relation === "child" && ageGroupMap[data.analysis.ageGroup]) {
          setNewMember(prev => ({ ...prev, ageGroup: ageGroupMap[data.analysis.ageGroup] }));
        }
        
        // Auto-detect if this is a child based on the photo
        if (["infant", "toddler", "child", "teen"].includes(data.analysis.ageGroup)) {
          if (newMember.relation !== "child") {
            setNewMember(prev => ({ 
              ...prev, 
              relation: "child",
              ageGroup: ageGroupMap[data.analysis.ageGroup] || ""
            }));
          }
        }

        toast({
          title: "Photo analyzed",
          description: `Detected: ${data.analysis.estimatedAge} (${data.analysis.confidence} confidence)`,
        });
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Age detection unavailable",
        description: "You can manually select the age group below.",
        variant: "default",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          setPendingBase64(base64);
          
          // Upload photo first
          const response = await fetch("/api/upload/family-photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: base64 }),
          });

          if (!response.ok) {
            let errorMsg = "Upload failed";
            try {
              const errorData = await response.json();
              errorMsg = errorData.message || errorMsg;
            } catch {
              errorMsg = `Server error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMsg);
          }
          
          const data = await response.json();
          setNewMember({ ...newMember, photo: data.photoUrl });
          toast({ title: "Photo uploaded" });
          if (fileInputRef.current) fileInputRef.current.value = "";
          
          // Automatically analyze the photo for age detection
          setUploading(false);
          analyzePersonPhoto(base64);
        } catch (error) {
          console.error("Upload error:", error);
          toast({ 
            title: "Photo upload failed", 
            description: error instanceof Error ? error.message : "An error occurred",
            variant: "destructive" 
          });
          setUploading(false);
        }
      };
      reader.onerror = () => {
        toast({ title: "Photo read failed", variant: "destructive" });
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({ 
        title: "Photo upload failed", 
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive" 
      });
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const relationLabels: Record<string, string> = {
    self: "Me",
    spouse: "Spouse/Partner",
    child: "Child",
    parent: "Parent",
    other: "Other",
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (relation: string) => {
    if (relation === "child") return "bg-purple-500/20 text-purple-600";
    if (relation === "spouse") return "bg-blue-500/20 text-blue-600";
    return "bg-blue-500/20 text-blue-600";
  };

  const getAgeGroupLabel = (ageGroup: string) => {
    const labels: Record<string, string> = {
      infant: "Infant (0-1)",
      toddler: "Toddler (1-3)",
      child: "Child (4-12)",
      teen: "Teen (13-17)",
      adult: "Adult",
      senior: "Senior",
    };
    return labels[ageGroup] || ageGroup;
  };

  return (
    <div className="space-y-4">
      {/* Existing Members */}
      {members.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Your Family Members</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={member.photo || undefined} />
                    <AvatarFallback className={getAvatarColor(member.relation)}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{member.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {relationLabels[member.relation as keyof typeof relationLabels] || member.relation}
                    </div>
                    {member.ageGroup && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {member.ageGroup}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1 flex-shrink-0"
                  onClick={() => deleteMutation.mutate(member.id)}
                  data-testid={`button-delete-member-${member.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Member */}
      <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <Label className="text-sm font-medium text-foreground">Add Family Member</Label>
        </div>

        <div className="space-y-3">
          {/* Photo Preview with AI Analysis */}
          {newMember.photo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-background rounded-lg border">
                <div className="flex items-center gap-2">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={newMember.photo} />
                    <AvatarFallback>Photo</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="text-sm text-muted-foreground">Photo uploaded</span>
                    {analyzing && (
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setNewMember({ ...newMember, photo: "" });
                    setAnalysisResult(null);
                    setPendingBase64("");
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
              
              {/* AI Analysis Result */}
              {analysisResult && (
                <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                    <Sparkles className="w-3 h-3" />
                    AI Analysis
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>
                      <span className="font-medium">Estimated age:</span> {analysisResult.estimatedAge}
                    </div>
                    <div>
                      <span className="font-medium">Category:</span> {getAgeGroupLabel(analysisResult.ageGroup)}
                    </div>
                    {analysisResult.observations && (
                      <div className="text-muted-foreground/70 italic mt-1">
                        {analysisResult.observations}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="member-name" className="text-xs">
                Name
              </Label>
              <Input
                id="member-name"
                placeholder="Enter name"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                data-testid="input-member-name"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="member-relation" className="text-xs">
                Relation
              </Label>
              <Select
                value={newMember.relation}
                onValueChange={(v) => setNewMember({ ...newMember, relation: v })}
              >
                <SelectTrigger id="member-relation" data-testid="select-member-relation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Me</SelectItem>
                  <SelectItem value="spouse">Spouse/Partner</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {newMember.relation === "child" && (
            <div className="space-y-1">
              <Label htmlFor="member-agegroup" className="text-xs flex items-center gap-1">
                Age Group
                {analysisResult && ["infant", "toddler", "child", "teen"].includes(analysisResult.ageGroup) && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    <Sparkles className="w-2 h-2 mr-0.5" />
                    AI detected
                  </Badge>
                )}
              </Label>
              <Select
                value={newMember.ageGroup}
                onValueChange={(v) => setNewMember({ ...newMember, ageGroup: v })}
              >
                <SelectTrigger id="member-agegroup" data-testid="select-member-agegroup">
                  <SelectValue placeholder="Select age..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infant">Infant (0-1)</SelectItem>
                  <SelectItem value="toddler">Toddler (1-3)</SelectItem>
                  <SelectItem value="child">Child (4-12)</SelectItem>
                  <SelectItem value="teen">Teen (13-17)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Photo Upload */}
          <div>
            <Label htmlFor="member-photo" className="text-xs flex items-center gap-1">
              Photo (Optional)
              <span className="text-muted-foreground font-normal">- AI will detect age</span>
            </Label>
            <input
              ref={fileInputRef}
              id="member-photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={uploading || analyzing}
              className="hidden"
              data-testid="input-member-photo"
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1 gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || analyzing}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Uploading...
                </>
              ) : analyzing ? (
                <>
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              if (!newMember.name.trim()) {
                toast({ title: "Please enter a name", variant: "destructive" });
                return;
              }
              addMutation.mutate(newMember);
            }}
            disabled={addMutation.isPending || !newMember.name.trim() || uploading || analyzing}
            className="w-full"
            data-testid="button-add-member"
          >
            <Users className="w-3 h-3 mr-2" />
            Add Member
          </Button>
        </div>
      </div>
    </div>
  );
}
