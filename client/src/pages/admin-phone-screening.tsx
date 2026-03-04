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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, GripVertical, Pencil, Trash2, Phone, AlertCircle } from "lucide-react";
import type { PhoneScreeningQuestion } from "@shared/schema";

const CATEGORIES = [
  { value: "introduction", label: "Introduction" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "experience", label: "Experience" },
  { value: "housing", label: "Housing" },
  { value: "expectations", label: "Expectations" },
  { value: "closing", label: "Closing" },
];

const SCENARIOS = [
  { value: "adoption", label: "Adoption" },
  { value: "foster", label: "Foster" },
  { value: "rehome", label: "Rehome" },
];

const RESPONSE_TYPES = [
  { value: "open", label: "Open-ended" },
  { value: "yes_no", label: "Yes/No" },
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "rating", label: "Rating (1-5)" },
];

interface QuestionFormData {
  questionText: string;
  aiPrompt: string;
  followUpRules: string;
  category: string;
  scenario: string;
  aiTags: string[];
  expectedResponseType: string;
  scoringCriteria: string;
  isRequired: boolean;
  isActive: boolean;
}

const defaultFormData: QuestionFormData = {
  questionText: "",
  aiPrompt: "",
  followUpRules: "",
  category: "introduction",
  scenario: "adoption",
  aiTags: [],
  expectedResponseType: "open",
  scoringCriteria: "",
  isRequired: true,
  isActive: true,
};

export default function AdminPhoneScreening() {
  const { toast } = useToast();
  const [activeScenario, setActiveScenario] = useState("adoption");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<PhoneScreeningQuestion | null>(null);
  const [formData, setFormData] = useState<QuestionFormData>(defaultFormData);
  const [tagsText, setTagsText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: questions = [], isLoading } = useQuery<PhoneScreeningQuestion[]>({
    queryKey: ["/api/admin/phone-screening-questions"],
  });

  const filteredQuestions = questions.filter((q) => q.scenario === activeScenario);

  const createMutation = useMutation({
    mutationFn: (data: Partial<PhoneScreeningQuestion>) =>
      apiRequest("POST", "/api/admin/phone-screening-questions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-screening-questions"] });
      toast({ title: "Question created", description: "The phone screening question has been added." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PhoneScreeningQuestion> }) =>
      apiRequest("PUT", `/api/admin/phone-screening-questions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-screening-questions"] });
      toast({ title: "Question updated", description: "The question has been updated." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/phone-screening-questions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-screening-questions"] });
      toast({ title: "Question deleted", description: "The question has been removed." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (questionIds: string[]) =>
      apiRequest("POST", "/api/admin/phone-screening-questions/reorder", { questionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/phone-screening-questions"] });
    },
  });

  const openCreateDialog = () => {
    setEditingQuestion(null);
    setFormData({ ...defaultFormData, scenario: activeScenario });
    setTagsText("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: PhoneScreeningQuestion) => {
    setEditingQuestion(question);
    setFormData({
      questionText: question.questionText,
      aiPrompt: question.aiPrompt || "",
      followUpRules: question.followUpRules || "",
      category: question.category,
      scenario: question.scenario,
      aiTags: question.aiTags || [],
      expectedResponseType: question.expectedResponseType || "open",
      scoringCriteria: question.scoringCriteria || "",
      isRequired: question.isRequired,
      isActive: question.isActive,
    });
    setTagsText((question.aiTags || []).join(", "));
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingQuestion(null);
    setFormData(defaultFormData);
    setTagsText("");
  };

  const handleSubmit = () => {
    if (!formData.questionText.trim()) {
      toast({ title: "Error", description: "Question text is required", variant: "destructive" });
      return;
    }

    const aiTags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const data = { ...formData, aiTags };

    if (editingQuestion) {
      updateMutation.mutate({ id: editingQuestion.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...filteredQuestions];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMutation.mutate(newOrder.map((q) => q.id));
  };

  const groupedQuestions = filteredQuestions.reduce((acc, q) => {
    const category = q.category || "introduction";
    if (!acc[category]) acc[category] = [];
    acc[category].push(q);
    return acc;
  }, {} as Record<string, PhoneScreeningQuestion[]>);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
              <Phone className="w-6 h-6" />
              Phone Screening Questions
            </h1>
            <p className="text-muted-foreground">
              Manage AI-powered phone screening questions for Vapi calls
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-add-question">
            <Plus className="w-4 h-4 mr-2" />
            Add Question
          </Button>
        </div>

        <Tabs value={activeScenario} onValueChange={setActiveScenario}>
          <TabsList>
            {SCENARIOS.map((scenario) => (
              <TabsTrigger
                key={scenario.value}
                value={scenario.value}
                data-testid={`tab-${scenario.value}`}
              >
                {scenario.label}
                <Badge variant="secondary" className="ml-2">
                  {questions.filter((q) => q.scenario === scenario.value).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {SCENARIOS.map((scenario) => (
            <TabsContent key={scenario.value} value={scenario.value} className="space-y-6 mt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No questions for {scenario.label}</h3>
                    <p className="text-muted-foreground mb-4">
                      Add questions for the AI to ask during phone screening
                    </p>
                    <Button onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Question
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-6">
                  {CATEGORIES.map(({ value: catKey, label: catLabel }) => {
                    const catQuestions = groupedQuestions[catKey] || [];
                    if (catQuestions.length === 0) return null;

                    return (
                      <Card key={catKey}>
                        <CardHeader>
                          <CardTitle className="text-lg">{catLabel}</CardTitle>
                          <CardDescription>
                            {catQuestions.length} question{catQuestions.length !== 1 ? "s" : ""}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {catQuestions.map((question, index) => (
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
                                  onClick={() => handleMoveUp(filteredQuestions.findIndex((q) => q.id === question.id))}
                                  disabled={filteredQuestions.findIndex((q) => q.id === question.id) === 0}
                                >
                                  <GripVertical className="w-4 h-4 rotate-90" />
                                </Button>
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-medium">{question.questionText}</p>
                                {question.aiPrompt && (
                                  <p className="text-sm text-muted-foreground mt-1 truncate">
                                    AI Prompt: {question.aiPrompt}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {RESPONSE_TYPES.find((t) => t.value === question.expectedResponseType)?.label || "Open-ended"}
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
                                  {question.aiTags?.slice(0, 3).map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
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
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? "Edit Phone Screening Question" : "Add Phone Screening Question"}
              </DialogTitle>
              <DialogDescription>
                Configure a question for the AI to ask during phone screening calls
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="questionText">Question Text *</Label>
                <Textarea
                  id="questionText"
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="What question should the AI ask?"
                  data-testid="input-question-text"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiPrompt">AI Prompt (optional)</Label>
                <Textarea
                  id="aiPrompt"
                  value={formData.aiPrompt}
                  onChange={(e) => setFormData({ ...formData, aiPrompt: e.target.value })}
                  placeholder="Additional context for the AI on how to ask this question or interpret responses..."
                  data-testid="input-ai-prompt"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scenario">Scenario</Label>
                  <Select
                    value={formData.scenario}
                    onValueChange={(value) => setFormData({ ...formData, scenario: value })}
                  >
                    <SelectTrigger data-testid="select-scenario">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCENARIOS.map((scenario) => (
                        <SelectItem key={scenario.value} value={scenario.value}>
                          {scenario.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedResponseType">Expected Response Type</Label>
                <Select
                  value={formData.expectedResponseType}
                  onValueChange={(value) => setFormData({ ...formData, expectedResponseType: value })}
                >
                  <SelectTrigger data-testid="select-response-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiTags">AI Tags (comma-separated)</Label>
                <Input
                  id="aiTags"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="family, housing, experience"
                  data-testid="input-ai-tags"
                />
                <p className="text-xs text-muted-foreground">
                  Tags help the AI understand and route responses appropriately
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scoringCriteria">Scoring Criteria (optional)</Label>
                <Textarea
                  id="scoringCriteria"
                  value={formData.scoringCriteria}
                  onChange={(e) => setFormData({ ...formData, scoringCriteria: e.target.value })}
                  placeholder="How should the AI evaluate responses to this question?"
                  data-testid="input-scoring-criteria"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="followUpRules">Follow-up Rules (optional, JSON)</Label>
                <Textarea
                  id="followUpRules"
                  value={formData.followUpRules}
                  onChange={(e) => setFormData({ ...formData, followUpRules: e.target.value })}
                  placeholder='{"if_negative": "ask_clarification", "if_concerning": "probe_deeper"}'
                  data-testid="input-followup-rules"
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
                Are you sure you want to delete this phone screening question? This action cannot be undone.
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
