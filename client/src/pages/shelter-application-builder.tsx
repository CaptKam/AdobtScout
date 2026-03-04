import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  FileText,
  Type,
  AlignLeft,
  List,
  CheckSquare,
  ToggleLeft,
  Save,
  ArrowUp,
  ArrowDown,
  Loader2,
  Lock,
} from "lucide-react";
import type { ShelterApplicationForm, ShelterApplicationQuestion, ApplicationQuestion } from "@shared/schema";

interface AdminQuestionDisplay {
  id: string;
  questionText: string;
  questionType: string;
  helperText: string | null;
  options: string[] | null;
  isRequired: boolean;
  position: number;
  mode: string;
  section: string | null;
  source: 'platform';
}

interface QuestionFormData {
  id?: string;
  questionText: string;
  questionType: string;
  helperText: string;
  options: string[];
  isRequired: boolean;
}

const QUESTION_TYPES = [
  { value: "text", label: "Short Text", icon: Type },
  { value: "textarea", label: "Long Text", icon: AlignLeft },
  { value: "select", label: "Single Select", icon: List },
  { value: "multiselect", label: "Multi Select", icon: CheckSquare },
  { value: "yes_no", label: "Yes / No", icon: ToggleLeft },
];

const getTypeIcon = (type: string) => {
  const typeConfig = QUESTION_TYPES.find(t => t.value === type);
  return typeConfig?.icon || Type;
};

const getTypeLabel = (type: string) => {
  const typeConfig = QUESTION_TYPES.find(t => t.value === type);
  return typeConfig?.label || "Text";
};

export default function ShelterApplicationBuilderPage() {
  const { toast } = useToast();
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const isApplicationBuilderEnabled = flagsLoading ? false : (featureFlags?.enabledFeatures?.includes('shelter_application_builder') ?? false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuestionFormData | null>(null);
  const [optionInput, setOptionInput] = useState("");

  const { data, isLoading, error } = useQuery<{
    form: ShelterApplicationForm | null;
    questions: ShelterApplicationQuestion[];
    adminQuestions: AdminQuestionDisplay[];
  }>({
    queryKey: ["/api/shelter/application-questions"],
  });

  const createQuestionMutation = useMutation({
    mutationFn: (question: Partial<QuestionFormData>) =>
      apiRequest("POST", "/api/shelter/application-questions", question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/application-questions"] });
      toast({ title: "Question Created", description: "Your question has been added." });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<QuestionFormData>) =>
      apiRequest("PATCH", `/api/shelter/application-questions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/application-questions"] });
      toast({ title: "Question Updated", description: "Your changes have been saved." });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/shelter/application-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/application-questions"] });
      toast({ title: "Question Deleted", description: "The question has been removed." });
      setQuestionToDelete(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: string[]) =>
      apiRequest("PATCH", "/api/shelter/application-questions/reorder", { questionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/application-questions"] });
    },
  });

  const openCreateDialog = () => {
    setEditingQuestion({
      questionText: "",
      questionType: "text",
      helperText: "",
      options: [],
      isRequired: false,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: ShelterApplicationQuestion) => {
    setEditingQuestion({
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      helperText: question.helperText || "",
      options: question.options || [],
      isRequired: question.isRequired,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingQuestion(null);
    setOptionInput("");
  };

  const handleSave = () => {
    if (!editingQuestion || !editingQuestion.questionText.trim()) {
      toast({ title: "Error", description: "Question text is required.", variant: "destructive" });
      return;
    }

    // Check for duplicate of admin question (only for new questions or if text changed)
    if (isDuplicateOfAdminQuestion(editingQuestion.questionText)) {
      toast({ 
        title: "Duplicate Question", 
        description: "This question is similar to a platform standard question. Please create a different question to avoid asking users duplicate questions.",
        variant: "destructive" 
      });
      return;
    }

    const questionData = {
      questionText: editingQuestion.questionText,
      questionType: editingQuestion.questionType,
      helperText: editingQuestion.helperText || undefined,
      options: editingQuestion.options.length > 0 ? editingQuestion.options : undefined,
      isRequired: editingQuestion.isRequired,
    };

    if (editingQuestion.id) {
      updateQuestionMutation.mutate({ id: editingQuestion.id, ...questionData });
    } else {
      createQuestionMutation.mutate(questionData);
    }
  };

  const addOption = () => {
    if (!optionInput.trim() || !editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: [...editingQuestion.options, optionInput.trim()],
    });
    setOptionInput("");
  };

  const removeOption = (index: number) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: editingQuestion.options.filter((_, i) => i !== index),
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    if (!data?.questions) return;
    const questions = [...data.questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    
    [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
    reorderMutation.mutate(questions.map(q => q.id));
  };

  const confirmDelete = (id: string) => {
    setQuestionToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const questions = data?.questions || [];
  const adminQuestions = data?.adminQuestions || [];
  const showOptionsField = editingQuestion?.questionType === "select" || editingQuestion?.questionType === "multiselect";
  
  // Check for potential duplicate questions (fuzzy match)
  const isDuplicateOfAdminQuestion = (text: string) => {
    const normalizedText = text.toLowerCase().trim();
    return adminQuestions.some(aq => 
      aq.questionText.toLowerCase().trim() === normalizedText ||
      aq.questionText.toLowerCase().includes(normalizedText) ||
      normalizedText.includes(aq.questionText.toLowerCase())
    );
  };

  return (
    
      <div className="p-4 md:p-6 space-y-6" data-testid="page-application-builder">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Application Builder</h1>
            <p className="text-sm md:text-base text-muted-foreground">Customize the questions adopters see when applying for your dogs</p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-question">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>

        {/* Platform Standard Questions - Read Only */}
        {adminQuestions.length > 0 && (
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-muted-foreground" />
                Platform Standard Questions
              </CardTitle>
              <CardDescription>
                These questions are set by the platform and will be asked to all adopters. 
                You cannot edit or remove them, but you can add your own questions below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adminQuestions.map((question) => {
                  const TypeIcon = getTypeIcon(question.questionType);
                  return (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 opacity-80"
                      data-testid={`admin-question-item-${question.id}`}
                    >
                      <div className="flex items-center text-muted-foreground pt-1">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className="font-medium text-muted-foreground" data-testid={`text-admin-question-${question.id}`}>
                            {question.questionText}
                          </h4>
                          {question.isRequired && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">Platform</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <TypeIcon className="w-4 h-4" />
                          <span>{getTypeLabel(question.questionType)}</span>
                          {question.options && question.options.length > 0 && (
                            <span className="text-xs">({question.options.length} options)</span>
                          )}
                        </div>
                        {question.helperText && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            {question.helperText}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Custom Shelter Questions - Editable */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Your Custom Questions
            </CardTitle>
            <CardDescription>
              Add your own questions to gather shelter-specific information from adopters.
              These will be shown after the platform standard questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Failed to load questions. Please try again.
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Custom Questions Yet</h3>
                <p className="mb-4">Add questions to gather specific information from adopters.</p>
                <Button onClick={openCreateDialog} variant="outline" data-testid="button-add-first-question">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Question
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question, index) => {
                  const TypeIcon = getTypeIcon(question.questionType);
                  return (
                    <div
                      key={question.id}
                      className="flex items-start gap-3 p-4 rounded-lg border bg-card hover-elevate transition-all"
                      data-testid={`question-item-${question.id}`}
                    >
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <GripVertical className="w-5 h-5 cursor-move" />
                        <div className="flex flex-col gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveQuestion(index, "up")}
                            disabled={index === 0}
                            data-testid={`button-move-up-${question.id}`}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveQuestion(index, "down")}
                            disabled={index === questions.length - 1}
                            data-testid={`button-move-down-${question.id}`}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <h4 className="font-medium" data-testid={`text-question-${question.id}`}>
                            {question.questionText}
                          </h4>
                          {question.isRequired && (
                            <Badge variant="secondary" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <TypeIcon className="w-4 h-4" />
                          <span>{getTypeLabel(question.questionType)}</span>
                          {question.options && question.options.length > 0 && (
                            <span className="text-xs">({question.options.length} options)</span>
                          )}
                        </div>
                        {question.helperText && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            {question.helperText}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(question)}
                          data-testid={`button-edit-${question.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => confirmDelete(question.id)}
                          data-testid={`button-delete-${question.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion?.id ? "Edit Question" : "Add Question"}
              </DialogTitle>
            </DialogHeader>
            {editingQuestion && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="questionText">Question Text *</Label>
                  <Textarea
                    id="questionText"
                    placeholder="Enter your question..."
                    value={editingQuestion.questionText}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                    }
                    className="resize-none"
                    rows={2}
                    data-testid="input-question-text"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questionType">Question Type</Label>
                  <Select
                    value={editingQuestion.questionType}
                    onValueChange={(value) =>
                      setEditingQuestion({ ...editingQuestion, questionType: value, options: [] })
                    }
                  >
                    <SelectTrigger data-testid="select-question-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((type) => {
                        const Icon = type.icon;
                        return (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {showOptionsField && (
                  <div className="space-y-2">
                    <Label>Options</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add an option..."
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                        data-testid="input-option"
                      />
                      <Button type="button" onClick={addOption} variant="secondary" data-testid="button-add-option">
                        Add
                      </Button>
                    </div>
                    {editingQuestion.options.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {editingQuestion.options.map((option, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="gap-1 pr-1"
                          >
                            {option}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-4 w-4 ml-1"
                              onClick={() => removeOption(index)}
                              data-testid={`button-remove-option-${index}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="helperText">Helper Text (Optional)</Label>
                  <Input
                    id="helperText"
                    placeholder="Additional context or instructions..."
                    value={editingQuestion.helperText}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, helperText: e.target.value })
                    }
                    data-testid="input-helper-text"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="isRequired" className="cursor-pointer">
                    Required Question
                  </Label>
                  <Switch
                    id="isRequired"
                    checked={editingQuestion.isRequired}
                    onCheckedChange={(checked) =>
                      setEditingQuestion({ ...editingQuestion, isRequired: checked })
                    }
                    data-testid="switch-required"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                data-testid="button-save-question"
              >
                {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                <Save className="w-4 h-4 mr-2" />
                {editingQuestion?.id ? "Save Changes" : "Create Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Question?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the question from your application form. Existing applications with answers to this question will not be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => questionToDelete && deleteQuestionMutation.mutate(questionToDelete)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                {deleteQuestionMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    
  );
}
