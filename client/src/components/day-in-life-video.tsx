
import { useState } from "react";
import { Play, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DayInLifeVideoProps {
  videoUrl?: string;
  dogName: string;
}

export default function DayInLifeVideo({ videoUrl, dogName }: DayInLifeVideoProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  if (!videoUrl) return null;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-video bg-black">
        {!isPlaying ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: `url(${videoUrl.replace('.mp4', '-thumb.jpg')})` }}
            />
            <Button
              size="lg"
              className="relative z-10 w-20 h-20 rounded-full"
              onClick={() => setIsPlaying(true)}
            >
              <Play className="w-8 h-8 ml-1" />
            </Button>
            <div className="absolute bottom-4 left-4 text-white font-semibold text-lg drop-shadow-lg">
              A Day with {dogName}
            </div>
          </div>
        ) : (
          <>
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-full"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setIsPlaying(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
