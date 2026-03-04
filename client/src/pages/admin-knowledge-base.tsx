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
import { Plus, Pencil, Trash2, Brain, Eye, EyeOff, AlertCircle, Search } from "lucide-react";
import type { VapiKnowledgeBaseEntry } from "@shared/schema";

const CATEGORIES = [
  { value: "policies", label: "Policies", description: "Adoption policies and guidelines" },
  { value: "faq", label: "FAQ", description: "Frequently asked questions" },
  { value: "procedures", label: "Procedures", description: "Step-by-step processes" },
  { value: "dog_info", label: "Dog Info", description: "Information about dogs" },
  { value: "shelter_info", label: "Shelter Info", description: "Shelter details and hours" },
  { value: "adoption_process", label: "Adoption Process", description: "How adoption works" },
  { value: "general", label: "General", description: "General information" },
];

interface EntryFormData {
  title: string;
  content: string;
  contentSummary: string;
  category: string;
  tags: string[];
  priority: number;
  isPublished: boolean;
}

const defaultFormData: EntryFormData = {
  title: "",
  content: "",
  contentSummary: "",
  category: "general",
  tags: [],
  priority: 0,
  isPublished: false,
};

export default function AdminKnowledgeBase() {
  const { toast } = useToast();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<VapiKnowledgeBaseEntry | null>(null);
  const [formData, setFormData] = useState<EntryFormData>(defaultFormData);
  const [tagsText, setTagsText] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const { data: entries = [], isLoading } = useQuery<VapiKnowledgeBaseEntry[]>({
    queryKey: ["/api/admin/vapi-knowledge-base"],
  });

  const filteredEntries = entries.filter((entry) => {
    const matchesCategory = activeCategory === "all" || entry.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<VapiKnowledgeBaseEntry>) =>
      apiRequest("POST", "/api/admin/vapi-knowledge-base", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vapi-knowledge-base"] });
      toast({ title: "Entry created", description: "Knowledge base entry has been added." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VapiKnowledgeBaseEntry> }) =>
      apiRequest("PUT", `/api/admin/vapi-knowledge-base/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vapi-knowledge-base"] });
      toast({ title: "Entry updated", description: "Knowledge base entry has been updated." });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/vapi-knowledge-base/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vapi-knowledge-base"] });
      toast({ title: "Entry deleted", description: "Knowledge base entry has been removed." });
      setDeleteConfirmId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      apiRequest("PATCH", `/api/admin/vapi-knowledge-base/${id}/publish`, { isPublished }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vapi-knowledge-base"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingEntry(null);
    setFormData({ ...defaultFormData, category: activeCategory === "all" ? "general" : activeCategory });
    setTagsText("");
    setPreviewMode(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (entry: VapiKnowledgeBaseEntry) => {
    setEditingEntry(entry);
    setFormData({
      title: entry.title,
      content: entry.content,
      contentSummary: entry.contentSummary || "",
      category: entry.category,
      tags: entry.tags || [],
      priority: entry.priority,
      isPublished: entry.isPublished,
    });
    setTagsText((entry.tags || []).join(", "));
    setPreviewMode(false);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
    setFormData(defaultFormData);
    setTagsText("");
    setPreviewMode(false);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Error", description: "Title is required", variant: "destructive" });
      return;
    }
    if (!formData.content.trim()) {
      toast({ title: "Error", description: "Content is required", variant: "destructive" });
      return;
    }

    const tags = tagsText.split(",").map((t) => t.trim()).filter(Boolean);
    const data = { ...formData, tags };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const togglePublish = (entry: VapiKnowledgeBaseEntry) => {
    publishMutation.mutate({ id: entry.id, isPublished: !entry.isPublished });
  };

  const publishedCount = entries.filter((e) => e.isPublished).length;
  const draftCount = entries.filter((e) => !e.isPublished).length;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="page-title">
              <Brain className="w-6 h-6" />
              AI Knowledge Base
            </h1>
            <p className="text-muted-foreground">
              Manage knowledge content for Vapi AI phone assistants
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {publishedCount} Published
            </Badge>
            <Badge variant="outline">
              {draftCount} Drafts
            </Badge>
            <Button onClick={openCreateDialog} data-testid="button-add-entry">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all" data-testid="tab-all">
              All
              <Badge variant="secondary" className="ml-2">
                {entries.length}
              </Badge>
            </TabsTrigger>
            {CATEGORIES.map((cat) => {
              const count = entries.filter((e) => e.category === cat.value).length;
              return (
                <TabsTrigger key={cat.value} value={cat.value} data-testid={`tab-${cat.value}`}>
                  {cat.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">
                    {searchQuery ? "No entries found" : "No knowledge entries yet"}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? "Try adjusting your search query"
                      : "Add content for the AI to use during phone calls"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={openCreateDialog}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Entry
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEntries.map((entry) => (
                  <Card key={entry.id} className="group" data-testid={`entry-card-${entry.id}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">{entry.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {CATEGORIES.find((c) => c.value === entry.category)?.label}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => togglePublish(entry)}
                          className={entry.isPublished ? "text-green-600" : "text-muted-foreground"}
                          data-testid={`button-publish-${entry.id}`}
                        >
                          {entry.isPublished ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {entry.contentSummary || entry.content.slice(0, 150)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {entry.isPublished ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            Published
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Draft
                          </Badge>
                        )}
                        {entry.priority > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Priority: {entry.priority}
                          </Badge>
                        )}
                        {entry.tags?.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {(entry.tags?.length || 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(entry.tags?.length || 0) - 2}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(entry)}
                          data-testid={`button-edit-${entry.id}`}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteConfirmId(entry.id)}
                          className="text-destructive"
                          data-testid={`button-delete-${entry.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
              </DialogTitle>
              <DialogDescription>
                Add content that the AI can reference during phone screening calls
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Adoption Fee Policy"
                  data-testid="input-title"
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
                  <Label htmlFor="priority">Priority (0-10)</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={0}
                    max={10}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    data-testid="input-priority"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher priority content is more likely to be referenced
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Content * (Markdown supported)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    {previewMode ? "Edit" : "Preview"}
                  </Button>
                </div>
                {previewMode ? (
                  <div className="min-h-48 p-4 border rounded-md bg-muted/50 prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: formData.content.replace(/\n/g, "<br/>") }} />
                  </div>
                ) : (
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter the knowledge content. Markdown formatting is supported..."
                    rows={10}
                    data-testid="input-content"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contentSummary">Summary (for AI quick reference)</Label>
                <Textarea
                  id="contentSummary"
                  value={formData.contentSummary}
                  onChange={(e) => setFormData({ ...formData, contentSummary: e.target.value })}
                  placeholder="A brief summary the AI can use for quick context..."
                  rows={2}
                  data-testid="input-summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="adoption, fees, puppies, seniors"
                  data-testid="input-tags"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isPublished"
                  checked={formData.isPublished}
                  onCheckedChange={(checked) => setFormData({ ...formData, isPublished: checked })}
                  data-testid="switch-published"
                />
                <Label htmlFor="isPublished">
                  {formData.isPublished ? "Published (AI can access)" : "Draft (not visible to AI)"}
                </Label>
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
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Knowledge Entry</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this knowledge base entry? This action cannot be undone.
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
