import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Check,
  Circle,
  AlertCircle,
  Clock,
  Camera,
  Stethoscope,
  PawPrint,
  FileText,
  Syringe,
  Home,
  ArrowRight,
  Scale,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Dog, IntakeRecord } from "@shared/schema";

export interface DogWithIntake extends Dog {
  intake: IntakeRecord | null;
}

interface StageChecklistProps {
  dog: DogWithIntake;
  vaccines?: any[];
  medicalRecords?: any[];
  tasks?: any[];
}

interface ChecklistItem {
  id: string;
  label: string;
  description?: string;
  completed: boolean;
  required: boolean;
  icon: React.ElementType;
}

interface StageRequirements {
  stage: string;
  label: string;
  items: ChecklistItem[];
  nextStage?: string;
}

const STAGE_CONFIGS: Record<string, { label: string; nextStage?: string }> = {
  intake: { label: "Intake", nextStage: "stray_hold" },
  stray_hold: { label: "Stray Hold", nextStage: "medical_hold" },
  medical_hold: { label: "Medical Hold", nextStage: "behavior_eval" },
  behavior_eval: { label: "Behavior Eval", nextStage: "ready" },
  pre_adoption_hold: { label: "Pre-Adoption Hold", nextStage: "adopted" },
  ready: { label: "Ready", nextStage: "featured" },
  featured: { label: "Featured", nextStage: "adopted" },
  adopted: { label: "Adopted" },
};

export function deriveStageChecklist(
  dog: DogWithIntake,
  vaccines: any[] = [],
  medicalRecords: any[] = [],
  tasks: any[] = []
): StageRequirements {
  const currentStage = dog.intake?.pipelineStatus || "intake";
  const config = STAGE_CONFIGS[currentStage] || { label: currentStage };
  
  const holdType = dog.intake?.holdType || dog.holdType;
  const holdExpiresAt = dog.intake?.holdExpiresAt || dog.holdExpiresAt;
  const holdExpired = holdExpiresAt && new Date(holdExpiresAt) <= new Date();
  
  const hasPhotos = dog.photos && dog.photos.length > 0;
  const hasIntakeRecord = !!dog.intake?.intakeDate;
  const hasBehaviorNotes = !!(dog.intake as any)?.behaviorNotes;
  const isVaccinated = vaccines.length > 0;
  const hasMedicalRecords = medicalRecords.length > 0;
  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const stageTasks = pendingTasks.filter(t => t.taskType === currentStage || !t.taskType);
  
  const items: ChecklistItem[] = [];

  switch (currentStage) {
    case "intake":
      items.push({
        id: "intake-record",
        label: "Complete intake form",
        description: "Basic info, source, and initial observations",
        completed: hasIntakeRecord,
        required: true,
        icon: FileText,
      });
      items.push({
        id: "photos",
        label: "Upload photos",
        description: "At least one photo for identification",
        completed: hasPhotos,
        required: true,
        icon: Camera,
      });
      items.push({
        id: "initial-exam",
        label: "Initial health screening",
        description: "Basic health check and weight",
        completed: hasMedicalRecords || !!dog.weight,
        required: false,
        icon: Stethoscope,
      });
      break;

    case "stray_hold":
      items.push({
        id: "hold-period",
        label: "Stray hold period",
        description: holdExpired ? "Hold period complete" : "Waiting for hold to expire",
        completed: !!holdExpired,
        required: true,
        icon: Clock,
      });
      items.push({
        id: "photos",
        label: "Upload photos",
        completed: hasPhotos,
        required: true,
        icon: Camera,
      });
      items.push({
        id: "no-owner-claim",
        label: "No owner claim received",
        completed: true,
        required: true,
        icon: Scale,
      });
      break;

    case "medical_hold":
      items.push({
        id: "medical-records",
        label: "Medical evaluation",
        description: "Complete health assessment",
        completed: hasMedicalRecords,
        required: true,
        icon: Stethoscope,
      });
      items.push({
        id: "vaccines",
        label: "Core vaccinations",
        description: "Rabies, DHPP, Bordetella",
        completed: isVaccinated,
        required: true,
        icon: Syringe,
      });
      items.push({
        id: "spay-neuter",
        label: "Spay/Neuter status",
        description: (dog as any).isNeutered ? "Completed" : "Schedule if needed",
        completed: !!(dog as any).isNeutered,
        required: false,
        icon: Stethoscope,
      });
      items.push({
        id: "medical-hold",
        label: "Medical hold cleared",
        description: holdType === "medical_hold" ? (holdExpired ? "Cleared" : "Active") : "N/A",
        completed: holdType !== "medical_hold" || !!holdExpired,
        required: holdType === "medical_hold",
        icon: Check,
      });
      break;

    case "behavior_eval":
      items.push({
        id: "behavior-notes",
        label: "Behavior assessment",
        description: "Temperament, socialization, training level",
        completed: hasBehaviorNotes,
        required: true,
        icon: PawPrint,
      });
      items.push({
        id: "dog-test",
        label: "Dog compatibility test",
        description: "Interaction with other dogs",
        completed: (dog as any).goodWithDogs !== undefined && (dog as any).goodWithDogs !== null,
        required: false,
        icon: PawPrint,
      });
      items.push({
        id: "cat-test",
        label: "Cat compatibility test",
        description: "Interaction with cats",
        completed: (dog as any).goodWithCats !== undefined && (dog as any).goodWithCats !== null,
        required: false,
        icon: PawPrint,
      });
      items.push({
        id: "child-test",
        label: "Child compatibility test",
        description: "Interaction with children",
        completed: (dog as any).goodWithKids !== undefined && (dog as any).goodWithKids !== null,
        required: false,
        icon: PawPrint,
      });
      break;

    case "pre_adoption_hold":
      const hasReservedAdopter = !!(dog.intake as any)?.reservedAdopterId || holdType === "pre_adoption_hold";
      items.push({
        id: "adopter-confirmed",
        label: "Adopter confirmed",
        description: hasReservedAdopter ? "Application approved" : "Awaiting approved applicant",
        completed: hasReservedAdopter,
        required: true,
        icon: ClipboardList,
      });
      items.push({
        id: "hold-period",
        label: "Hold period",
        description: holdExpired ? "Complete" : "Waiting for adopter pickup",
        completed: !!holdExpired,
        required: true,
        icon: Clock,
      });
      break;

    case "ready":
      items.push({
        id: "photos",
        label: "Quality photos uploaded",
        description: "Clear, attractive photos for listing",
        completed: hasPhotos && dog.photos!.length >= 2,
        required: true,
        icon: Camera,
      });
      items.push({
        id: "bio",
        label: "Bio written",
        description: "Compelling adoption bio",
        completed: !!(dog as any).description && (dog as any).description.length > 50,
        required: true,
        icon: FileText,
      });
      items.push({
        id: "all-tasks",
        label: "All tasks complete",
        description: stageTasks.length > 0 ? `${stageTasks.length} pending` : "All done",
        completed: stageTasks.length === 0,
        required: false,
        icon: ClipboardList,
      });
      break;

    case "featured":
      items.push({
        id: "featured-listing",
        label: "Featured listing active",
        completed: true,
        required: true,
        icon: Check,
      });
      items.push({
        id: "social-shared",
        label: "Shared on social media",
        completed: false,
        required: false,
        icon: Home,
      });
      break;

    case "adopted":
      items.push({
        id: "adoption-complete",
        label: "Adoption finalized",
        completed: true,
        required: true,
        icon: Check,
      });
      break;
  }

  return {
    stage: currentStage,
    label: config.label,
    items,
    nextStage: config.nextStage,
  };
}

export function StageChecklist({ dog, vaccines = [], medicalRecords = [], tasks = [] }: StageChecklistProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const checklist = useMemo(
    () => deriveStageChecklist(dog, vaccines, medicalRecords, tasks),
    [dog, vaccines, medicalRecords, tasks]
  );

  const completedCount = checklist.items.filter(i => i.completed).length;
  const totalCount = checklist.items.length;
  const requiredItems = checklist.items.filter(i => i.required);
  const requiredComplete = requiredItems.filter(i => i.completed).length;
  const allRequiredComplete = requiredComplete === requiredItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <Card data-testid="stage-checklist">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover-elevate rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Stage Checklist
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isOpen && !allRequiredComplete && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    {requiredItems.length - requiredComplete} remaining
                  </span>
                )}
                {!isOpen && allRequiredComplete && (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                <Badge variant={allRequiredComplete ? "default" : "secondary"} className="text-xs">
                  {completedCount}/{totalCount}
                </Badge>
              </div>
            </div>
            <Progress value={progressPercent} className="h-1.5 mt-2" />
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            <div className="space-y-2">
              {checklist.items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                      item.completed ? "bg-green-500/10" : "bg-muted/50"
                    }`}
                    data-testid={`checklist-item-${item.id}`}
                  >
                    <div className="mt-0.5">
                      {item.completed ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : item.required ? (
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className={`text-sm ${item.completed ? "text-muted-foreground line-through" : ""}`}>
                          {item.label}
                        </span>
                        {item.required && !item.completed && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            Required
                          </Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
