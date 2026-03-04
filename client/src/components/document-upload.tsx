
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface DocumentUploadProps {
  journeyId: string;
  documentType: string;
  onUploadComplete?: () => void;
}

export default function DocumentUpload({ journeyId, documentType, onUploadComplete }: DocumentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload document with AI processing
      const response = await apiRequest("POST", "/api/adoption-documents", {
        journeyId,
        documentType,
        fileName: file.name,
        fileUrl: `/uploads/${file.name}`, // Placeholder - would need actual file storage
        imageBase64: base64
      });

      const result = await response.json();
      setProcessingResult(result.aiProcessingResult);

      toast({
        title: "Document uploaded! 🎉",
        description: result.aiProcessingResult?.isValid 
          ? "Document verified successfully"
          : "Document uploaded - pending review"
      });

      onUploadComplete?.();
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getDocumentLabel = () => {
    switch (documentType) {
      case "id": return "Government ID";
      case "proof_of_residence": return "Proof of Residence";
      case "vet_reference": return "Veterinary Reference";
      default: return "Document";
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{getDocumentLabel()}</h3>
            {processingResult && (
              <Badge variant={processingResult.isValid ? "default" : "secondary"}>
                {processingResult.verificationStatus === "verified" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {processingResult.verificationStatus === "needs_review" && <AlertCircle className="w-3 h-3 mr-1" />}
                {processingResult.verificationStatus}
              </Badge>
            )}
          </div>

          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              id={`upload-${documentType}`}
              disabled={isUploading}
            />
            <label htmlFor={`upload-${documentType}`} className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                {isUploading ? (
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                ) : (
                  <Upload className="w-12 h-12 text-muted-foreground" />
                )}
                <div className="text-sm font-medium">
                  {isUploading ? "Processing document..." : "Click to upload"}
                </div>
                <div className="text-xs text-muted-foreground">
                  AI will automatically extract and verify information
                </div>
              </div>
            </label>
          </div>

          {processingResult && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="w-4 h-4" />
                AI Processing Results
              </div>
              <div className="text-xs space-y-1">
                <div>Confidence: {processingResult.confidence}%</div>
                {processingResult.extractedData && Object.keys(processingResult.extractedData).length > 0 && (
                  <div className="mt-2">
                    <div className="font-medium mb-1">Extracted Data:</div>
                    {Object.entries(processingResult.extractedData).map(([key, value]: [string, any]) => (
                      <div key={key} className="text-muted-foreground">
                        {key}: {String(value)}
                      </div>
                    ))}
                  </div>
                )}
                {processingResult.concerns?.length > 0 && (
                  <div className="mt-2 text-amber-600 dark:text-amber-400">
                    Concerns: {processingResult.concerns.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
