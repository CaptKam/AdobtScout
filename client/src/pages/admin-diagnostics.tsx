import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Activity, CheckCircle2, XCircle, AlertTriangle, Play, Loader2, Clock, Database, Server, Shield, Zap, SkipForward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/admin-layout";
import type { DiagnosticResult, RouteTestConfig, RunAllResponse, RunAllSummary } from "@shared/schema";

function StatusBadge({ status }: { status: "PASS" | "FAIL" | "WARN" | "SKIP" }) {
  if (status === "PASS") {
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        PASS
      </Badge>
    );
  }
  if (status === "FAIL") {
    return (
      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
        <XCircle className="w-3 h-3 mr-1" />
        FAIL
      </Badge>
    );
  }
  if (status === "SKIP") {
    return (
      <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
        <SkipForward className="w-3 h-3 mr-1" />
        SKIP
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
      <AlertTriangle className="w-3 h-3 mr-1" />
      WARN
    </Badge>
  );
}

function SummaryCard({ title, value, icon: Icon, variant }: { 
  title: string; 
  value: number; 
  icon: any;
  variant: "default" | "success" | "error" | "warning";
}) {
  const variants = {
    default: "bg-slate-800/50 border-slate-700",
    success: "bg-green-900/30 border-green-700/50",
    error: "bg-red-900/30 border-red-700/50",
    warning: "bg-amber-900/30 border-amber-700/50",
  };
  
  const iconColors = {
    default: "text-slate-400",
    success: "text-green-400",
    error: "text-red-400",
    warning: "text-amber-400",
  };

  return (
    <Card className={`${variants[variant]} border`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${iconColors[variant]}`} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDiagnosticsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTest, setSelectedTest] = useState<DiagnosticResult | null>(null);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [summary, setSummary] = useState<RunAllSummary | null>(null);

  const { data: routes = [] } = useQuery<RouteTestConfig[]>({
    queryKey: ["/api/admin/diagnostics/routes"],
  });

  const runAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/diagnostics/run-all");
      return response.json() as Promise<RunAllResponse>;
    },
    onSuccess: (data) => {
      setResults(data.results);
      setSummary(data.summary);
    },
  });

  const categories = Array.from(new Set(routes.map(r => r.category)));

  const filteredResults = results.filter(result => {
    const matchesSearch = 
      result.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (result.route?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === "all" || result.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || result.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-primary" />
                System Diagnostics
              </h1>
              <p className="text-slate-400 mt-1">
                Monitor and test platform health across all services
              </p>
            </div>
            <Button
              onClick={() => runAllMutation.mutate()}
              disabled={runAllMutation.isPending}
              className="gap-2"
              data-testid="button-run-all-tests"
            >
              {runAllMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Tests
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <SummaryCard
              title="Total Tests"
              value={summary?.total ?? routes.length}
              icon={Server}
              variant="default"
            />
            <SummaryCard
              title="Passed"
              value={summary?.passed ?? 0}
              icon={CheckCircle2}
              variant="success"
            />
            <SummaryCard
              title="Failed"
              value={summary?.failed ?? 0}
              icon={XCircle}
              variant="error"
            />
            <SummaryCard
              title="Warnings"
              value={summary?.warned ?? 0}
              icon={AlertTriangle}
              variant="warning"
            />
            <SummaryCard
              title="Skipped"
              value={summary?.skipped ?? 0}
              icon={SkipForward}
              variant="default"
            />
          </div>

          {summary && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="py-3">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <span>Duration: <span className="text-white font-medium">{summary.durationMs}ms</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Zap className="w-4 h-4" />
                    <span>Started: <span className="text-white font-medium">{new Date(summary.startedAt).toLocaleTimeString()}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Database className="w-4 h-4" />
                    <span>Finished: <span className="text-white font-medium">{new Date(summary.finishedAt).toLocaleTimeString()}</span></span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Test Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4">
                <Input
                  placeholder="Search tests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-xs bg-slate-900 border-slate-600 text-white"
                  data-testid="input-search-tests"
                />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px] bg-slate-900 border-slate-600 text-white" data-testid="select-category-filter">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] bg-slate-900 border-slate-600 text-white" data-testid="select-status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="PASS">Pass</SelectItem>
                    <SelectItem value="FAIL">Fail</SelectItem>
                    <SelectItem value="WARN">Warning</SelectItem>
                    <SelectItem value="SKIP">Skipped</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {results.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">No test results yet</p>
                  <p className="text-slate-500 text-sm mt-1">Click "Run All Tests" to start diagnostics</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Test</TableHead>
                        <TableHead className="text-slate-400">Category</TableHead>
                        <TableHead className="text-slate-400">Route</TableHead>
                        <TableHead className="text-slate-400">Method</TableHead>
                        <TableHead className="text-slate-400">Duration</TableHead>
                        <TableHead className="text-slate-400">Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result) => (
                        <TableRow
                          key={result.id}
                          className="border-slate-700 cursor-pointer hover:bg-slate-700/50"
                          onClick={() => setSelectedTest(result)}
                          data-testid={`row-test-${result.id}`}
                        >
                          <TableCell>
                            <StatusBadge status={result.status} />
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            {result.label}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-slate-300 border-slate-600">
                              {result.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 font-mono text-sm">
                            {result.route}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="bg-slate-700 text-slate-300">
                              {result.method}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-mono ${result.durationMs > 1000 ? 'text-amber-400' : 'text-slate-300'}`}>
                            {result.durationMs}ms
                          </TableCell>
                          <TableCell className="text-slate-300">
                            {result.statusCode || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedTest && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-white">
                    Test Details: {selectedTest.label}
                  </CardTitle>
                  <StatusBadge status={selectedTest.status} />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 p-4 rounded-lg overflow-auto text-sm text-slate-300 font-mono">
                  {JSON.stringify(selectedTest, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
