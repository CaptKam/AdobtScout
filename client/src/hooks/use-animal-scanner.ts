import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export interface TemperamentData {
  calmLevel: number;
  friendlinessScore: number;
  confidenceScore: number;
  stressScore: number;
  energyEstimate: "low" | "medium" | "high";
}

export interface ScanResult {
  breed: string;
  breedConfidence: "high" | "medium" | "low";
  species: "dog" | "cat" | "other";
  size: "small" | "medium" | "large";
  ageCategory: "puppy" | "young" | "adult" | "senior";
  estimatedAge: string;
  energyLevel: "low" | "moderate" | "high" | "very_high";
  coatColor: string;
  estimatedWeight: string;
  temperament: TemperamentData;
  suggestedTemperament: string[];
  suggestedGoodWithKids: boolean | null;
  suggestedGoodWithDogs: boolean | null;
  suggestedGoodWithCats: boolean | null;
  observations: string;
  bodyLanguage: {
    tailPosition: string;
    earPosition: string;
    posture: string;
    facialExpression: string;
  };
  imageBase64?: string;
}

type ScanStatus = "idle" | "initializing" | "ready" | "scanning" | "analyzing" | "complete" | "error";

interface UseAnimalScannerOptions {
  onScanComplete?: (result: ScanResult) => void;
  onError?: (error: string) => void;
  autoCapture?: boolean;
}

export function useAnimalScanner(options: UseAnimalScannerOptions = {}) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Use refs to store latest callbacks to avoid stale closure issues during async operations
  const onScanCompleteRef = useRef(options.onScanComplete);
  const onErrorRef = useRef(options.onError);
  
  // Keep refs updated with latest callbacks
  useEffect(() => {
    onScanCompleteRef.current = options.onScanComplete;
    onErrorRef.current = options.onError;
  }, [options.onScanComplete, options.onError]);
  
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("environment");

  const initializeCamera = useCallback(async () => {
    setStatus("initializing");
    setError(null);
    
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setStatus("ready");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to access camera";
      setError(message);
      setStatus("error");
      options.onError?.(message);
      // No toast - the UI component shows a friendly error state instead
    }
  }, [cameraFacing, toast, options]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const switchCamera = useCallback(() => {
    setCameraFacing(prev => prev === "user" ? "environment" : "user");
  }, []);

  useEffect(() => {
    if (status === "ready" || status === "initializing") {
      initializeCamera();
    }
  }, [cameraFacing]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return null;
    
    // Capture the full video frame (no cropping)
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const analyzeImage = useCallback(async (imageBase64: string): Promise<ScanResult | null> => {
    setStatus("analyzing");
    
    try {
      const response = await fetch("/api/analyze/animal-scan", {
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

      const result: ScanResult = {
        ...data.analysis,
        imageBase64,
      };
      
      setScanResult(result);
      setStatus("complete");
      
      // Use ref to get latest callback - avoids stale closure during long API calls
      onScanCompleteRef.current?.(result);
      
      toast({
        title: "Scan Complete!",
        description: `Identified as ${result.breed} (${result.breedConfidence} confidence)`,
      });
      
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to analyze image";
      setError(message);
      setStatus("error");
      onErrorRef.current?.(message);
      
      toast({
        title: "Analysis Failed",
        description: message,
        variant: "destructive",
      });
      
      return null;
    }
  }, [toast]); // Removed options from deps - using refs instead

  const scan = useCallback(async () => {
    setStatus("scanning");
    
    const imageData = captureFrame();
    if (!imageData) {
      setError("Failed to capture frame");
      setStatus("error");
      return null;
    }
    
    setCapturedImage(imageData);
    return await analyzeImage(imageData);
  }, [captureFrame, analyzeImage]);

  const analyzeUploadedImage = useCallback(async (imageBase64: string) => {
    setCapturedImage(imageBase64);
    return await analyzeImage(imageBase64);
  }, [analyzeImage]);

  const reset = useCallback(() => {
    setScanResult(null);
    setCapturedImage(null);
    setError(null);
    setStatus("ready");
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    status,
    error,
    scanResult,
    capturedImage,
    cameraFacing,
    initializeCamera,
    stopCamera,
    switchCamera,
    scan,
    analyzeUploadedImage,
    reset,
    isScanning: status === "scanning",
    isAnalyzing: status === "analyzing",
    isReady: status === "ready",
    isComplete: status === "complete",
  };
}
