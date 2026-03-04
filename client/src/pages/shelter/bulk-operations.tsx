import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Image,
  MessageSquare,
  Edit3,
  Stethoscope,
  RefreshCw,
  Trash2,
  Send,
  Plus,
  FileText,
  Users,
  Dog,
  Clock,
} from "lucide-react";
import type { Dog as DogType } from "@shared/schema";

interface CsvRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportPreview {
  valid: CsvRow[];
  invalid: { row: CsvRow; errors: ValidationError[] }[];
  headers: string[];
}

interface MessageTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  phone?: string;
  type: string;
}

interface BulkImportLog {
  id: number;
  importType: string;
  totalRecords: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let wasQuoted = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        wasQuoted = true;
        i++;
      } else if (char === ',') {
        result.push(wasQuoted ? current : current.trim());
        current = '';
        wasQuoted = false;
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  
  result.push(wasQuoted ? current : current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = parseCsvLine(line);
      const row: CsvRow = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  
  return { headers, rows };
}

function ImportTab() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCsv(text);
    
    const requiredFields = ['name', 'breed', 'age'];
    const valid: CsvRow[] = [];
    const invalid: { row: CsvRow; errors: ValidationError[] }[] = [];
    
    rows.forEach((row, index) => {
      const errors: ValidationError[] = [];
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({ row: index + 2, field, message: `${field} is required` });
        }
      });
      
      if (row.age && isNaN(Number(row.age))) {
        errors.push({ row: index + 2, field: 'age', message: 'Age must be a number' });
      }
      
      if (errors.length > 0) {
        invalid.push({ row, errors });
      } else {
        valid.push(row);
      }
    });
    
    setPreview({ valid, invalid, headers });
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/shelter/bulk/templates/dogs');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dog_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) => {
      setImporting(true);
      setProgress(0);
      
      const batchSize = 10;
      let processed = 0;
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await apiRequest("POST", "/api/shelter/bulk/import/dogs", { dogs: batch });
        processed += batch.length;
        setProgress(Math.round((processed / rows.length) * 100));
      }
      
      return { total: rows.length, processed };
    },
    onSuccess: (result) => {
      toast({ 
        title: "Import Complete", 
        description: `Successfully imported ${result.processed} dogs` 
      });
      setFile(null);
      setPreview(null);
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/bulk/history"] });
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      setImporting(false);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            CSV Dog Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file to bulk import dogs. Download the template for the correct format.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
          
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
              data-testid="input-csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop CSV file here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                {file ? file.name : "Supports .csv files"}
              </p>
            </label>
          </div>
          
          {preview && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {preview.valid.length} Valid
                </Badge>
                {preview.invalid.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {preview.invalid.length} Invalid
                  </Badge>
                )}
              </div>
              
              {preview.invalid.length > 0 && (
                <Card className="border-destructive">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Validation Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      {preview.invalid.map((item, i) => (
                        <div key={i} className="text-sm py-1">
                          {item.errors.map((err, j) => (
                            <p key={j} className="text-destructive">
                              Row {err.row}: {err.field} - {err.message}
                            </p>
                          ))}
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              
              {preview.valid.length > 0 && (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Preview ({preview.valid.length} rows)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {preview.headers.slice(0, 5).map(h => (
                              <TableHead key={h}>{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {preview.valid.slice(0, 10).map((row, i) => (
                            <TableRow key={i}>
                              {preview.headers.slice(0, 5).map(h => (
                                <TableCell key={h}>{row[h]}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Importing... {progress}%
                  </p>
                </div>
              )}
              
              <Button
                onClick={() => importMutation.mutate(preview.valid)}
                disabled={preview.valid.length === 0 || importing}
                data-testid="button-start-import"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import {preview.valid.length} Dogs
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BatchEditTab() {
  const { toast } = useToast();
  const [selectedDogs, setSelectedDogs] = useState<Set<number | string>>(new Set());
  const [batchAction, setBatchAction] = useState<string>("");
  const [batchValue, setBatchValue] = useState<string>("");

  const { data: dogs = [], isLoading } = useQuery<DogType[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const batchUpdateMutation = useMutation({
    mutationFn: async () => {
      const dogIds = Array.from(selectedDogs);
      const updates: any = {};
      
      if (batchAction === "listingType") updates.listingType = batchValue;
      if (batchAction === "urgencyLevel") updates.urgencyLevel = batchValue;
      if (batchAction === "approvalStatus") updates.approvalStatus = batchValue;
      if (batchAction === "isPublic") updates.isPublic = batchValue === "true";
      
      return apiRequest("PATCH", "/api/shelter/bulk/dogs/status", { dogIds, updates });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: `Updated ${selectedDogs.size} dogs` });
      setSelectedDogs(new Set());
      setBatchAction("");
      setBatchValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleSelectAll = () => {
    if (selectedDogs.size === dogs.length) {
      setSelectedDogs(new Set());
    } else {
      setSelectedDogs(new Set(dogs.map(d => d.id)));
    }
  };

  const toggleSelect = (id: number | string) => {
    const newSet = new Set(selectedDogs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedDogs(newSet);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="w-5 h-5" />
            Batch Edit Dogs
          </CardTitle>
          <CardDescription>
            Select multiple dogs to update their status, listing type, or visibility at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {selectedDogs.size > 0 && (
            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
              <Badge variant="secondary">{selectedDogs.size} selected</Badge>
              
              <Select value={batchAction} onValueChange={setBatchAction}>
                <SelectTrigger className="w-48" data-testid="select-batch-action">
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="listingType">Change Listing Type</SelectItem>
                  <SelectItem value="urgencyLevel">Change Urgency</SelectItem>
                  <SelectItem value="approvalStatus">Change Status</SelectItem>
                  <SelectItem value="isPublic">Change Visibility</SelectItem>
                </SelectContent>
              </Select>
              
              {batchAction === "listingType" && (
                <Select value={batchValue} onValueChange={setBatchValue}>
                  <SelectTrigger className="w-48" data-testid="select-listing-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adoptable">Adoptable</SelectItem>
                    <SelectItem value="foster">Foster</SelectItem>
                    <SelectItem value="medical_hold">Medical Hold</SelectItem>
                    <SelectItem value="behavioral_hold">Behavioral Hold</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {batchAction === "urgencyLevel" && (
                <Select value={batchValue} onValueChange={setBatchValue}>
                  <SelectTrigger className="w-48" data-testid="select-urgency">
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {batchAction === "approvalStatus" && (
                <Select value={batchValue} onValueChange={setBatchValue}>
                  <SelectTrigger className="w-48" data-testid="select-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {batchAction === "isPublic" && (
                <Select value={batchValue} onValueChange={setBatchValue}>
                  <SelectTrigger className="w-48" data-testid="select-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Public</SelectItem>
                    <SelectItem value="false">Private</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              {batchAction && batchValue && (
                <Button 
                  onClick={() => batchUpdateMutation.mutate()}
                  disabled={batchUpdateMutation.isPending}
                  data-testid="button-apply-batch"
                >
                  {batchUpdateMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  Apply
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                onClick={() => setSelectedDogs(new Set())}
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading dogs...</div>
          ) : dogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No dogs found</div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox 
                        checked={selectedDogs.size === dogs.length && dogs.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Breed</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Visibility</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dogs.map((dog) => (
                    <TableRow key={dog.id} data-testid={`row-dog-${dog.id}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedDogs.has(dog.id)}
                          onCheckedChange={() => toggleSelect(dog.id)}
                          data-testid={`checkbox-dog-${dog.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{dog.name}</TableCell>
                      <TableCell>{dog.breed}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{dog.approvalStatus || "pending"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{dog.listingType || "adoptable"}</Badge>
                      </TableCell>
                      <TableCell>
                        {dog.isPublic ? (
                          <Badge className="bg-green-500/10 text-green-600">Public</Badge>
                        ) : (
                          <Badge variant="outline">Private</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PhotosTab() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { data: dogs = [] } = useQuery<DogType[]>({
    queryKey: ["/api/shelter/dogs"],
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/')
    );
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      setProgress(0);
      
      const formData = new FormData();
      files.forEach((file, i) => {
        formData.append(`photo_${i}`, file);
      });
      if (selectedDogId) {
        formData.append('dogId', selectedDogId);
      }
      
      const response = await fetch('/api/shelter/bulk/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      toast({ 
        title: "Upload Complete", 
        description: `Uploaded ${files.length} photos` 
      });
      setFiles([]);
      setUploading(false);
      if (selectedDogId) {
        queryClient.invalidateQueries({ queryKey: ["/api/shelter/dogs", selectedDogId] });
      }
    },
    onError: (error: any) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
      setUploading(false);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Mass Photo Upload
          </CardTitle>
          <CardDescription>
            Drag and drop multiple photos to upload them at once. Optionally assign them to a dog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-center">
            <Label>Assign to dog (optional):</Label>
            <Select value={selectedDogId} onValueChange={setSelectedDogId}>
              <SelectTrigger className="w-64" data-testid="select-photo-dog">
                <SelectValue placeholder="Select a dog..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignment</SelectItem>
                {dogs.map(dog => (
                  <SelectItem key={dog.id} value={String(dog.id)}>
                    {dog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="photo-upload"
              data-testid="input-photo-upload"
            />
            <label htmlFor="photo-upload" className="cursor-pointer">
              <Image className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop photos here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                Supports JPG, PNG, WEBP
              </p>
            </label>
          </div>
          
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{files.length} photos selected</Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setFiles([])}
                  data-testid="button-clear-photos"
                >
                  Clear All
                </Button>
              </div>
              
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {files.map((file, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full aspect-square object-cover rounded-md"
                    />
                    <button
                      onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-remove-photo-${i}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              
              {uploading && (
                <Progress value={progress} />
              )}
              
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={uploading}
                data-testid="button-upload-photos"
              >
                {uploading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload {files.length} Photos
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MedicalTab() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const text = await selectedFile.text();
    const { headers, rows } = parseCsv(text);
    
    const requiredFields = ['dogId', 'recordType', 'description'];
    const valid: CsvRow[] = [];
    const invalid: { row: CsvRow; errors: ValidationError[] }[] = [];
    
    rows.forEach((row, index) => {
      const errors: ValidationError[] = [];
      requiredFields.forEach(field => {
        if (!row[field] || row[field].trim() === '') {
          errors.push({ row: index + 2, field, message: `${field} is required` });
        }
      });
      
      if (errors.length > 0) {
        invalid.push({ row, errors });
      } else {
        valid.push(row);
      }
    });
    
    setPreview({ valid, invalid, headers });
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/shelter/bulk/templates/medical');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'medical_import_template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: "Error", description: "Failed to download template", variant: "destructive" });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (rows: CsvRow[]) => {
      setImporting(true);
      setProgress(0);
      
      await apiRequest("POST", "/api/shelter/bulk/import/medical", { records: rows });
      setProgress(100);
      
      return { total: rows.length };
    },
    onSuccess: (result) => {
      toast({ 
        title: "Import Complete", 
        description: `Successfully imported ${result.total} medical records` 
      });
      setFile(null);
      setPreview(null);
      setImporting(false);
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/bulk/history"] });
    },
    onError: (error: any) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
      setImporting(false);
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5" />
            Bulk Medical Records Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file to import medical records for multiple dogs at once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-medical-template">
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>
          
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="medical-csv-upload"
              data-testid="input-medical-csv-upload"
            />
            <label htmlFor="medical-csv-upload" className="cursor-pointer">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">Drop CSV file here or click to upload</p>
              <p className="text-sm text-muted-foreground mt-1">
                {file ? file.name : "Supports .csv files"}
              </p>
            </label>
          </div>
          
          {preview && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant="default" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {preview.valid.length} Valid
                </Badge>
                {preview.invalid.length > 0 && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {preview.invalid.length} Invalid
                  </Badge>
                )}
              </div>
              
              {preview.invalid.length > 0 && (
                <Card className="border-destructive">
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Validation Errors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      {preview.invalid.map((item, i) => (
                        <div key={i} className="text-sm py-1">
                          {item.errors.map((err, j) => (
                            <p key={j} className="text-destructive">
                              Row {err.row}: {err.field} - {err.message}
                            </p>
                          ))}
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
              
              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Importing... {progress}%
                  </p>
                </div>
              )}
              
              <Button
                onClick={() => importMutation.mutate(preview.valid)}
                disabled={preview.valid.length === 0 || importing}
                data-testid="button-start-medical-import"
              >
                {importing ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Import {preview.valid.length} Records
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessagingTab() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [recipientFilter, setRecipientFilter] = useState<string>("all");
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");

  const { data: templates = [] } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/shelter/templates"],
  });

  const { data: recipients = [] } = useQuery<Recipient[]>({
    queryKey: ["/api/shelter/bulk/recipients", recipientFilter],
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: { name: string; subject: string; body: string }) =>
      apiRequest("POST", "/api/shelter/templates", data),
    onSuccess: () => {
      toast({ title: "Template Saved" });
      setShowNewTemplate(false);
      setNewTemplateName("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/templates"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/shelter/bulk/message", {
        recipientIds: Array.from(selectedRecipients),
        subject,
        body: message,
      }),
    onSuccess: () => {
      toast({ 
        title: "Messages Sent", 
        description: `Sent to ${selectedRecipients.size} recipients` 
      });
      setSelectedRecipients(new Set());
      setSubject("");
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/shelter/bulk/history"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => String(t.id) === templateId);
    if (template) {
      setSubject(template.subject);
      setMessage(template.body);
    }
  };

  const toggleRecipient = (id: string) => {
    const newSet = new Set(selectedRecipients);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecipients(newSet);
  };

  const selectAllRecipients = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.id)));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Bulk Messaging
          </CardTitle>
          <CardDescription>
            Send messages to multiple recipients at once using templates or custom messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Message Template</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowNewTemplate(true)}
                  data-testid="button-new-template"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Save as Template
                </Button>
              </div>
              
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={String(template.id)}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Message subject"
                  data-testid="input-message-subject"
                />
              </div>
              
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your message..."
                  rows={6}
                  data-testid="input-message-body"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Recipients</Label>
                <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                  <SelectTrigger className="w-40" data-testid="select-recipient-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="adopters">Adopters</SelectItem>
                    <SelectItem value="fosters">Fosters</SelectItem>
                    <SelectItem value="applicants">Applicants</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={selectAllRecipients}
                  data-testid="button-select-all-recipients"
                >
                  {selectedRecipients.size === recipients.length ? "Deselect All" : "Select All"}
                </Button>
                <Badge variant="secondary">{selectedRecipients.size} selected</Badge>
              </div>
              
              <ScrollArea className="h-[240px] border rounded-md">
                {recipients.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No recipients found
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {recipients.map(recipient => (
                      <div
                        key={recipient.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer ${
                          selectedRecipients.has(recipient.id) ? "bg-primary/10" : "hover:bg-muted"
                        }`}
                        onClick={() => toggleRecipient(recipient.id)}
                        data-testid={`recipient-${recipient.id}`}
                      >
                        <Checkbox 
                          checked={selectedRecipients.has(recipient.id)}
                          onCheckedChange={() => toggleRecipient(recipient.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{recipient.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {recipient.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {recipient.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={selectedRecipients.size === 0 || !subject || !message || sendMutation.isPending}
              data-testid="button-send-messages"
            >
              {sendMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send to {selectedRecipients.size} Recipients
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save your current message as a reusable template.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g., Adoption Follow-up"
              data-testid="input-template-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTemplate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createTemplateMutation.mutate({
                name: newTemplateName,
                subject,
                body: message,
              })}
              disabled={!newTemplateName || createTemplateMutation.isPending}
              data-testid="button-save-template"
            >
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryTab() {
  const { data: history = [], isLoading } = useQuery<BulkImportLog[]>({
    queryKey: ["/api/shelter/bulk/history"],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Import History
        </CardTitle>
        <CardDescription>
          View past bulk imports and their results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No import history yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Failed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((log) => (
                <TableRow key={log.id} data-testid={`history-row-${log.id}`}>
                  <TableCell>
                    <Badge variant="outline">{log.importType}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{log.totalRecords}</TableCell>
                  <TableCell>
                    <span className="text-green-600">{log.successCount}</span>
                  </TableCell>
                  <TableCell>
                    {log.failureCount > 0 ? (
                      <span className="text-red-600">{log.failureCount}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShelterBulkOperations() {
  return (
    <div className="p-4 md:p-6 space-y-6" data-testid="page-shelter-bulk-operations">
      <div>
        <h1 className="text-xl md:text-2xl font-bold" data-testid="text-page-title">Bulk Operations</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Import data, batch edit records, and send bulk communications.
        </p>
      </div>
      
      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="w-full flex overflow-x-auto gap-1 justify-start md:grid md:grid-cols-6" data-testid="tabs-bulk-operations">
          <TabsTrigger value="import" className="min-w-[100px] flex-shrink-0" data-testid="tab-import">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import
          </TabsTrigger>
          <TabsTrigger value="batch" className="min-w-[100px] flex-shrink-0" data-testid="tab-batch">
            <Edit3 className="w-4 h-4 mr-2" />
            Batch Edit
          </TabsTrigger>
          <TabsTrigger value="photos" className="min-w-[100px] flex-shrink-0" data-testid="tab-photos">
            <Image className="w-4 h-4 mr-2" />
            Photos
          </TabsTrigger>
          <TabsTrigger value="medical" className="min-w-[100px] flex-shrink-0" data-testid="tab-medical">
            <Stethoscope className="w-4 h-4 mr-2" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="messaging" className="min-w-[100px] flex-shrink-0" data-testid="tab-messaging">
            <MessageSquare className="w-4 h-4 mr-2" />
            Messaging
          </TabsTrigger>
          <TabsTrigger value="history" className="min-w-[100px] flex-shrink-0" data-testid="tab-history">
            <Clock className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="import">
          <ImportTab />
        </TabsContent>
        
        <TabsContent value="batch">
          <BatchEditTab />
        </TabsContent>
        
        <TabsContent value="photos">
          <PhotosTab />
        </TabsContent>
        
        <TabsContent value="medical">
          <MedicalTab />
        </TabsContent>
        
        <TabsContent value="messaging">
          <MessagingTab />
        </TabsContent>
        
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
