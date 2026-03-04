import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, X, RotateCcw, Scan, Upload, Check, AlertCircle, 
  Loader2, SwitchCamera, Sparkles, Zap, Heart, PawPrint
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAnimalScanner, ScanResult, TemperamentData } from "@/hooks/use-animal-scanner";

interface AnimalScannerProps {
  onScanComplete: (result: ScanResult) => void;
  onClose: () => void;
  className?: string;
}

function TemperamentMeter({ label, value, color }: { label: string; value: number; color: string }) {
  const percentage = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}

function ScanResultsCard({ result, onApply, onRetry }: { 
  result: ScanResult; 
  onApply: () => void;
  onRetry: () => void;
}) {
  const temperament = result.temperament;
  
  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case "low": return "bg-blue-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "bg-green-500 text-green-50";
      case "medium": return "bg-yellow-500 text-yellow-50";
      case "low": return "bg-orange-500 text-orange-50";
      default: return "bg-gray-500";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        {result.imageBase64 && (
          <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-primary shrink-0">
            <img 
              src={result.imageBase64} 
              alt="Scanned animal" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold">{result.breed}</h3>
            <Badge variant="secondary" className={cn("text-xs", getConfidenceColor(result.breedConfidence))}>
              {result.breedConfidence} confidence
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
            <span>{result.ageCategory}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{result.size}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{result.coatColor}</span>
          </div>
          {result.estimatedWeight && (
            <p className="text-xs text-muted-foreground mt-1">
              Est. weight: {result.estimatedWeight}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl">
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-primary" />
            Temperament
          </h4>
          <TemperamentMeter label="Calm" value={temperament.calmLevel} color="bg-blue-500" />
          <TemperamentMeter label="Friendly" value={temperament.friendlinessScore} color="bg-green-500" />
          <TemperamentMeter label="Confident" value={temperament.confidenceScore} color="bg-purple-500" />
          <TemperamentMeter label="Stress" value={temperament.stressScore} color="bg-red-500" />
        </div>
        
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-primary" />
            Energy Level
          </h4>
          <div className="flex items-center gap-2">
            <Badge className={cn("capitalize", getEnergyColor(temperament.energyEstimate))}>
              {temperament.energyEstimate}
            </Badge>
          </div>
          
          <h4 className="text-sm font-medium mt-4">Body Language</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            {result.bodyLanguage && (
              <>
                <p>Tail: {result.bodyLanguage.tailPosition}</p>
                <p>Ears: {result.bodyLanguage.earPosition}</p>
                <p>Posture: {result.bodyLanguage.posture}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {result.suggestedTemperament && result.suggestedTemperament.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Personality Traits</h4>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestedTemperament.map((trait) => (
              <Badge key={trait} variant="outline" className="text-xs capitalize">
                {trait}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.observations && (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <p className="text-sm text-muted-foreground">{result.observations}</p>
        </div>
      )}

      {/* Prominent call-to-action */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
        <p className="text-sm font-medium text-primary">
          Ready to auto-fill your form with these details?
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" onClick={onRetry} className="flex-1" data-testid="button-scan-retry">
          <RotateCcw className="w-4 h-4 mr-2" />
          Scan Again
        </Button>
        <Button onClick={onApply} className="flex-1 bg-primary hover:bg-primary/90" size="lg" data-testid="button-scan-apply">
          <Check className="w-4 h-4 mr-2" />
          Apply & Continue
        </Button>
      </div>
    </motion.div>
  );
}

function ScanningOverlay({ isScanning, isAnalyzing }: { isScanning: boolean; isAnalyzing: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="relative w-64 h-64">
        <motion.div
          className="absolute inset-0 border-2 border-primary rounded-3xl"
          animate={{
            scale: isScanning || isAnalyzing ? [1, 1.05, 1] : 1,
            opacity: isScanning || isAnalyzing ? [0.5, 1, 0.5] : 0.5,
          }}
          transition={{
            duration: 1.5,
            repeat: isScanning || isAnalyzing ? Infinity : 0,
            ease: "easeInOut",
          }}
        />
        
        <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-3xl" />
        <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-3xl" />
        <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-3xl" />
        <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-3xl" />

        {(isScanning || isAnalyzing) && (
          <motion.div
            className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent"
            initial={{ top: 0 }}
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}
      </div>

      {!isScanning && !isAnalyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute bottom-8 text-center"
        >
          <p className="text-white text-sm font-medium drop-shadow-lg">
            Position the animal within the frame
          </p>
          <p className="text-white/70 text-xs mt-1 drop-shadow">
            Move around for different angles
          </p>
        </motion.div>
      )}

      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center"
        >
          <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
          <p className="text-white font-medium">Analyzing...</p>
          <p className="text-white/70 text-sm">Detecting breed & temperament</p>
        </motion.div>
      )}
    </div>
  );
}

export function AnimalScanner({ onScanComplete, onClose, className }: AnimalScannerProps) {
  const [mode, setMode] = useState<"camera" | "upload" | "results">("camera");
  const fileInputRef = useState<HTMLInputElement | null>(null);
  
  const {
    videoRef,
    canvasRef,
    status,
    error,
    scanResult,
    capturedImage,
    initializeCamera,
    stopCamera,
    switchCamera,
    scan,
    analyzeUploadedImage,
    reset,
    isScanning,
    isAnalyzing,
    isReady,
    isComplete,
  } = useAnimalScanner({
    onScanComplete: (result) => {
      // Auto-apply results immediately and close scanner
      onScanComplete(result);
      onClose();
    },
  });

  useEffect(() => {
    if (mode === "camera") {
      initializeCamera();
    }
    return () => {
      stopCamera();
    };
  }, [mode]);

  // Auto-apply results when scan is complete (backup mechanism)
  useEffect(() => {
    if (isComplete && scanResult) {
      onScanComplete(scanResult);
      onClose();
    }
  }, [isComplete, scanResult]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await analyzeUploadedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (scanResult) {
      onScanComplete(scanResult);
      onClose();
    }
  };

  const handleRetry = () => {
    reset();
    setMode("camera");
    initializeCamera();
  };

  return (
    <div className={cn("fixed inset-0 z-50 bg-black", className)}>
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="bg-black/30 backdrop-blur text-white hover:bg-black/50"
          data-testid="button-scanner-close"
        >
          <X className="w-5 h-5" />
        </Button>
        
        {mode === "camera" && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={switchCamera}
              className="bg-black/30 backdrop-blur text-white hover:bg-black/50"
              data-testid="button-switch-camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === "camera" && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full flex flex-col"
          >
            <div className="flex-1 relative overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain bg-black"
              />
              <ScanningOverlay isScanning={isScanning} isAnalyzing={isAnalyzing} />
              
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <div className="text-center p-6 max-w-sm">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <p className="text-white font-medium mb-2">
                      {error.includes("camera") || error.includes("permission") || error.includes("device") 
                        ? "Camera Error" 
                        : "Scan Failed"}
                    </p>
                    <p className="text-white/70 text-sm mb-4">{error}</p>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" onClick={onClose} data-testid="button-error-close">
                        Close
                      </Button>
                      <Button onClick={() => { reset(); initializeCamera(); }} data-testid="button-retry-camera">
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-gradient-to-t from-black/90 to-black/0 pt-16">
              <div className="flex items-center justify-center gap-4">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-upload-photo"
                  />
                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                </label>

                <Button
                  size="lg"
                  onClick={scan}
                  disabled={!isReady || isScanning || isAnalyzing}
                  className="w-20 h-20 rounded-full bg-white hover:bg-white/90 text-black touch-manipulation"
                  style={{ touchAction: 'manipulation' }}
                  data-testid="button-capture"
                >
                  {isScanning || isAnalyzing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Scan className="w-8 h-8" />
                  )}
                </Button>

                <div className="w-12 h-12" />
              </div>
              
              <div className="text-center mt-4">
                <p className="text-white/70 text-sm">
                  {isScanning ? "Capturing..." : isAnalyzing ? "Analyzing with AI..." : "Tap to scan"}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {mode === "results" && scanResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full overflow-auto bg-background"
          >
            <div className="p-4 pt-16 pb-8 max-w-lg mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Scan Complete!</h2>
                  <p className="text-sm text-muted-foreground">Review and apply to your form</p>
                </div>
              </div>
              
              <ScanResultsCard 
                result={scanResult} 
                onApply={handleApply}
                onRetry={handleRetry}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ScannerTriggerButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn("gap-2", className)}
      data-testid="button-open-scanner"
    >
      <Camera className="w-4 h-4" />
      <span>AI Scan</span>
      <Badge variant="secondary" className="ml-1 text-xs bg-primary/10 text-primary">
        <Sparkles className="w-3 h-3 mr-1" />
        New
      </Badge>
    </Button>
  );
}
