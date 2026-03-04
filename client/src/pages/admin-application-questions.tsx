import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, GripVertical, Pencil, Trash2, AlertCircle } from "lucide-react";
import type { ApplicationQuestion } from "@shared/schema";

const QUESTION_TYPES = [
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text" },
  { value: "select", label: "Single Select" },
  { value: "multiselect", label: "Multi Select" },
  { value: "boolean", label: "Yes/No" },
  { value: "number", label: "Number" },
];

const SECTIONS = [
  { value: "general", label: "General" },
  { value: "housing", label: "Housing" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "experience", label: "Experience" },
  { value: "references", label: "References" },
];

const MODES = [
  { value: "all", label: "All Modes" },
  { value: "adopt", label: "Adopt Only" },
  { value: "foster", label: "Foster Only" },
  { value: "rehome", label: "Rehome Only" },
];

interface QuestionFormData {
  questionText: string;
  questionType: string;
  options: string[];
  helperText: string;
  placeholder: string;
  section: string;
  mode: string;
  isRequired: boolean;
  isActive: boolean;
}

const defaultFormData: QuestionFormData = {
  questionText: "",
  questionType: "text",
  options: [],
  helperText: "",
  placeholder: "",
  section: "general",
  mode: "all",
  isRequired: false,
  isActive: true,
};

export default function AdminApplicationQuestions() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<ApplicationQuestion | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>(defaultFormData);
  const [optionsText, setOptionsText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery<ApplicationQuestion[]>({
    queryKey: ["/api/admin/application-questions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ApplicationQuestion>) =>
      apiRequest("POST", "/api/admin/application-questions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/application-questions"] });
      toast({ title: "Question created", description: "The question has been added successfully." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ApplicationQuestion> }) =>
      apiRequest("PUT", `/api/admin/application-questions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/application-questions"] });
      toast({ title: "Question updated", description: "The question has been updated successfully." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/application-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/application-questions"] });
      toast({ title: "Question deleted", description: "The question has been removed." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: string[]) =>
      apiRequest("POST", "/api/admin/application-questions/reorder", { questionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/application-questions"] });
    },
  });

  const openCreateDialog = () => {
    setEditingQuestion(null);
    setFormData(defaultFormData);
    setOptionsText("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: ApplicationQuestion) => {
    setEditingQuestion(question);
    setFormData({
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options || [],
      helperText: question.helperText || "",
      placeholder: question.placeholder || "",
      section: question.section,
      mode: question.mode,
      isRequired: question.isRequired,
      isActive: question.isActive,
    });
    setOptionsText((question.options || []).join("\n"));
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingQuestion(null);
    setFormData(defaultFormData);
    setOptionsText("");
  };

  const handleSubmit = () => {
    if (!formData.questionText.trim()) {
      toast({ title: "Error", description: "Question text is required", variant: "destructive" });
      return;
    }

    const options = optionsText.split("\n").filter((o) => o.trim());
    const data = { ...formData, options };

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...questions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map((q) => q.id));
  };

  const handleMoveDown = (index: number) => {
    if (index === questions.length - 1) return;
    const newOrder = [...questions];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder.map((q) => q.id));
  };

  const groupedQuestions = questions.reduce((acc, q) => {
    const section = q.section || "general";
    if (!acc[section]) acc[section] = [];
    acc[section].push(q);
    return acc;
  }, {} as Record<string, ApplicationQuestion[]>);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
              Application Questions
            </h1>
            <p className="text-muted-foreground">
              Manage the questions shown in adoption application forms
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-question">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : questions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No questions yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first application question to get started
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {SECTIONS.map(({ value: sectionKey, label: sectionLabel }) => {
              const sectionQuestions = groupedQuestions[sectionKey] || [];
              if (sectionQuestions.length === 0) return null;

              return (
                <Card key={sectionKey}>
                  <CardHeader>
                    <CardTitle className="text-lg">{sectionLabel}</CardTitle>
                    <CardDescription>
                      {sectionQuestions.length} question{sectionQuestions.length !== 1 ? "s" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {sectionQuestions.map((question, index) => (
                      <div
                        key={question.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                        data-testid={`question-item-${question.id}`}
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMoveUp(questions.findIndex((q) => q.id === question.id))}
                            disabled={questions.findIndex((q) => q.id === question.id) === 0}
                          >
                            <GripVertical className="w-4 h-4 rotate-90" />
                          </Button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{question.questionText}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {QUESTION_TYPES.find((t) => t.value === question.questionType)?.label}
                            </Badge>
                            {question.isRequired && (
                              <Badge variant="outline" className="text-xs">
                                Required
                              </Badge>
                            )}
                            {!question.isActive && (
                              <Badge variant="destructive" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                            {question.mode !== "all" && (
                              <Badge variant="outline" className="text-xs">
                                {MODES.find((m) => m.value === question.mode)?.label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(question)}
                            data-testid={`button-edit-${question.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(question.id)}
                            data-testid={`button-delete-${question.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? "Edit Question" : "Add Question"}
              </DialogTitle>
              <DialogDescription>
                {editingQuestion
                  ? "Update the application question details"
                  : "Create a new question for the adoption application"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="questionText">Question Text *</Label>
                <Textarea
                  id="questionText"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="Enter your question..."
                  data-testid="input-question-text"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="questionType">Question Type</Label>
                  <Select
                    value={formData.questionType}
                    onValueChange={(value) => setFormData({ ...formData, questionType: value })}
                  >
                    <SelectTrigger data-testid="select-question-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="section">Section</Label>
                  <Select
                    value={formData.section}
                    onValueChange={(value) => setFormData({ ...formData, section: value })}
                  >
                    <SelectTrigger data-testid="select-section">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map((section) => (
                        <SelectItem key={section.value} value={section.value}>
                          {section.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Show For</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value) => setFormData({ ...formData, mode: value })}
                >
                  <SelectTrigger data-testid="select-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(formData.questionType === "select" || formData.questionType === "multiselect") && (
                <div className="space-y-2">
                  <Label htmlFor="options">Options (one per line)</Label>
                  <Textarea
                    id="options"
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    rows={4}
                    data-testid="input-options"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="helperText">Helper Text</Label>
                <Input
                  id="helperText"
                  value={formData.helperText}
                  onChange={(e) => setFormData({ ...formData, helperText: e.target.value })}
                  placeholder="Additional guidance for this question"
                  data-testid="input-helper-text"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input
                  id="placeholder"
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="Placeholder text for the input"
                  data-testid="input-placeholder"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    id="isRequired"
                    checked={formData.isRequired}
                    onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked })}
                    data-testid="switch-required"
                  />
                  <Label htmlFor="isRequired">Required question</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                    data-testid="switch-active"
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Question"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Question</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this question? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
