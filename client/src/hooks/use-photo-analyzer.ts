import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export type PhotoAnalysisType = "dog" | "person" | "home";

export interface DogAnalysisResult {
  breed: string;
  breedConfidence: "high" | "medium" | "low";
  size: "small" | "medium" | "large";
  ageCategory: "puppy" | "young" | "adult" | "senior";
  estimatedAge: string;
  energyLevel: "low" | "moderate" | "high" | "very_high";
  suggestedTemperament: string[];
  suggestedGoodWithKids: boolean | null;
  suggestedGoodWithDogs: boolean | null;
  suggestedGoodWithCats: boolean | null;
  coatColor: string;
  estimatedWeight: string;
  observations: string;
}

export interface PersonAnalysisResult {
  ageGroup: "infant" | "toddler" | "child" | "teen" | "adult" | "senior";
  estimatedAge: string;
  confidence: "high" | "medium" | "low";
  observations: string;
}

export interface HomeAnalysisResult {
  homeType: "house" | "apartment" | "condo" | "other";
  hasYard: boolean | null;
  yardSize: "small" | "medium" | "large" | null;
  isFenced: boolean | null;
  petFriendlyFeatures: string[];
  potentialConcerns: string[];
  overallSuitability: "excellent" | "good" | "fair" | "needs_improvement";
  observations: string;
  confidence: "high" | "medium" | "low";
}

export type AnalysisResult = DogAnalysisResult | PersonAnalysisResult | HomeAnalysisResult;

interface UsePhotoAnalyzerOptions {
  onAnalysisComplete?: (result: AnalysisResult, type: PhotoAnalysisType) => void;
  onError?: (error: string) => void;
}

export function usePhotoAnalyzer(options: UsePhotoAnalyzerOptions = {}) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<AnalysisResult | null>(null);

  const analyzePhoto = useCallback(async (
    imageBase64: string,
    type: PhotoAnalysisType
  ): Promise<AnalysisResult | null> => {
    setIsAnalyzing(true);
    
    try {
      const endpoint = type === "dog" 
        ? "/api/analyze/dog-photo"
        : type === "person"
        ? "/api/analyze/person-photo"
        : "/api/analyze/home-photo";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Analysis failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.analysis) {
        throw new Error(data.message || "Analysis returned no results");
      }

      setLastResult(data.analysis);
      options.onAnalysisComplete?.(data.analysis, type);
      
      return data.analysis;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to analyze photo";
      options.onError?.(message);
      toast({
        title: "Analysis failed",
        description: message,
        variant: "destructive",
      });
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [toast, options]);

  const analyzeDogPhoto = useCallback((imageBase64: string) => {
    return analyzePhoto(imageBase64, "dog") as Promise<DogAnalysisResult | null>;
  }, [analyzePhoto]);

  const analyzePersonPhoto = useCallback((imageBase64: string) => {
    return analyzePhoto(imageBase64, "person") as Promise<PersonAnalysisResult | null>;
  }, [analyzePhoto]);

  const analyzeHomePhoto = useCallback((imageBase64: string) => {
    return analyzePhoto(imageBase64, "home") as Promise<HomeAnalysisResult | null>;
  }, [analyzePhoto]);

  return {
    analyzePhoto,
    analyzeDogPhoto,
    analyzePersonPhoto,
    analyzeHomePhoto,
    isAnalyzing,
    lastResult,
  };
}
