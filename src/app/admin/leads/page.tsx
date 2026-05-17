"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Users,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Calendar,
  Filter,
  X,
  Key,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  Globe,
  Code2,
} from "lucide-react";
import ExcelJS from "exceljs";

type Lead = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  country_code: string | null;
  country: string | null;
  investment_range: string | null;
  message: string | null;
  source: string;
  created_at: string;
};

const INVESTMENT_RANGE_LABELS: Record<string, string> = {
  under_10k: "< $10K",
  "10k_50k": "$10K–$50K",
  "50k_100k": "$50K–$100K",
  "100k_250k": "$100K–$250K",
  "250k_500k": "$250K–$500K",
  "500k_plus": "$500K+",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminLeadsPage() {
  const queryClient = useQueryClient();
  const [emailFilter, setEmailFilter] = useState("");
  const [countryCodeFilter, setCountryCodeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  const { data: apiKeyData, refetch: refetchKey } = useQuery({
    queryKey: ["admin", "leads-api-key"],
    queryFn: async () => {
      const res = await fetch("/api/admin/leads/api-key");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ api_key: string; is_new: boolean }>;
    },
  });

  async function regenerateKey() {
    if (!confirm("Regenerate the API key? All existing external integrations will stop working until they are updated with the new key.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/admin/leads/api-key", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      await refetchKey();
      toast.success("API key regenerated");
    } catch {
      toast.error("Failed to regenerate key");
    } finally {
      setRegenerating(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
  }

  const apiKey = apiKeyData?.api_key ?? "";
  // Derive the endpoint URL from the current window origin (safe in client component)
  const endpointUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/leads`
    : "https://yourdomain.com/api/leads";

  // Applied filters (only applied on Search button click or immediate for email/cc)
  const [appliedEmail, setAppliedEmail] = useState("");
  const [appliedCountryCode, setAppliedCountryCode] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "leads", appliedEmail, appliedCountryCode, appliedDateFrom, appliedDateTo, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        ...(appliedEmail && { email: appliedEmail }),
        ...(appliedCountryCode && { country_code: appliedCountryCode }),
        ...(appliedDateFrom && { date_from: appliedDateFrom }),
        ...(appliedDateTo && { date_to: appliedDateTo }),
      });
      const res = await fetch(`/api/admin/leads?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function applyFilters() {
    setAppliedEmail(emailFilter);
    setAppliedCountryCode(countryCodeFilter);
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setPage(1);
  }

  function clearFilters() {
    setEmailFilter("");
    setCountryCodeFilter("");
    setDateFrom("");
    setDateTo("");
    setAppliedEmail("");
    setAppliedCountryCode("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setPage(1);
  }

  const hasActiveFilters = appliedEmail || appliedCountryCode || appliedDateFrom || appliedDateTo;

  async function deleteLead(id: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/leads?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Lead deleted");
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
    } catch {
      toast.error("Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  }

  async function exportAllToExcel() {
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "10000",
        ...(appliedEmail && { email: appliedEmail }),
        ...(appliedCountryCode && { country_code: appliedCountryCode }),
        ...(appliedDateFrom && { date_from: appliedDateFrom }),
        ...(appliedDateTo && { date_to: appliedDateTo }),
      });
      const res = await fetch(`/api/admin/leads?${params}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const leads: Lead[] = json.leads ?? [];

      if (leads.length === 0) {
        toast.error("No leads to export");
        return;
      }

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Leads");

      ws.columns = [
        { header: "Full Name",        key: "full_name",        width: 22 },
        { header: "Email",            key: "email",            width: 30 },
        { header: "Phone",            key: "phone",            width: 18 },
        { header: "Country Code",     key: "country_code",     width: 14 },
        { header: "Country",          key: "country",          width: 18 },
        { header: "Investment Range", key: "investment_range", width: 20 },
        { header: "Message",          key: "message",          width: 40 },
        { header: "Source",           key: "source",           width: 16 },
        { header: "Date Submitted",   key: "date_submitted",   width: 22 },
      ];

      for (const l of leads) {
        ws.addRow({
          full_name: l.full_name,
          email: l.email,
          phone: l.phone ?? "",
          country_code: l.country_code ?? "",
          country: l.country ?? "",
          investment_range: l.investment_range ? (INVESTMENT_RANGE_LABELS[l.investment_range] ?? l.investment_range) : "",
          message: l.message ?? "",
          source: l.source,
          date_submitted: formatDateTime(l.created_at),
        });
      }

      ws.getRow(1).font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${leads.length} leads`);
    } catch {
      toast.error("Failed to export");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-[#00D4FF]" />
            Leads
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.total ?? 0} total leads captured
          </p>
        </div>
        <Button
          onClick={exportAllToExcel}
          disabled={!data?.leads?.length}
          className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
        >
          <Download className="w-4 h-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      {/* API Integration */}
      <Card className="glass-card accent-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#00D4FF]" />
            External API Integration
            <Badge className="bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/25 text-[10px] ml-1">
              Cross-Origin Ready
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Point any external landing page or ad server at the endpoint below. Include the API key in the{" "}
            <code className="text-xs bg-background/80 border border-border rounded px-1.5 py-0.5 text-[#00D4FF]">x-api-key</code>{" "}
            request header and leads will flow directly into this panel.
          </p>

          {/* Endpoint */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Endpoint</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-background/50 border border-border rounded-lg px-3 py-2">
                <Badge className="bg-green-500/10 text-green-400 border-green-500/25 text-[10px] shrink-0">POST</Badge>
                <code className="text-sm text-foreground font-mono truncate">{endpointUrl}</code>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-[#00D4FF] shrink-0"
                onClick={() => copyToClipboard(endpointUrl, "Endpoint URL")}
                title="Copy URL"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">API Key</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 bg-background/50 border border-border rounded-lg px-3 py-2">
                <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                {apiKey ? (
                  <code className="text-sm font-mono tracking-wider flex-1 truncate">
                    {showKey ? apiKey : "•".repeat(Math.min(apiKey.length, 32))}
                  </code>
                ) : (
                  <Skeleton className="h-4 w-48" />
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-[#00D4FF] shrink-0"
                onClick={() => setShowKey((v) => !v)}
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-[#00D4FF] shrink-0"
                onClick={() => copyToClipboard(apiKey, "API key")}
                disabled={!apiKey}
                title="Copy key"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:text-amber-400 shrink-0"
                onClick={regenerateKey}
                disabled={regenerating}
                title="Regenerate key"
              >
                <RefreshCw className={`w-4 h-4 ${regenerating ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Keep this key private. Regenerating it will break any connected integrations until they are updated.
            </p>
          </div>

          {/* Code snippet toggle */}
          <button
            type="button"
            onClick={() => setShowCodeSnippet((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[#00D4FF] hover:underline"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showCodeSnippet ? "Hide" : "Show"} example request
          </button>

          {showCodeSnippet && (
            <div className="relative">
              <pre className="rounded-xl bg-[#0A0B0F] border border-border text-xs text-green-400 p-4 overflow-x-auto leading-relaxed">
{`// Works from any server, any language.
// Replace YOUR_API_KEY and update the field values.

fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${showKey && apiKey ? apiKey : "YOUR_API_KEY"}"
  },
  body: JSON.stringify({
    full_name:        "Jane Doe",
    email:            "jane@example.com",
    phone:            "+1 555 123 4567",    // optional
    country_code:     "+1",                 // optional
    country:          "United States",      // optional
    investment_range: "100k_250k",          // optional
    message:          "Interested in VIP.", // optional
    source:           "meta_ads_campaign1"  // tag the traffic source
  })
})
.then(r => r.json())
.then(console.log);
// → { "success": true }`}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 hover:text-[#00D4FF]"
                onClick={() => copyToClipboard(
                  `fetch("${endpointUrl}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "x-api-key": "${apiKey}"\n  },\n  body: JSON.stringify({\n    full_name: "Jane Doe",\n    email: "jane@example.com",\n    source: "meta_ads_campaign1"\n  })\n})`,
                  "Code snippet"
                )}
                title="Copy snippet"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Accepted investment_range values reference */}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground select-none">
              Valid <code className="text-[#00D4FF]">investment_range</code> values
            </summary>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 pl-3 border-l border-border">
              {Object.entries(INVESTMENT_RANGE_LABELS).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <code className="bg-background/80 border border-border rounded px-1.5 py-0.5 text-[10px] text-[#00D4FF]">{k}</code>
                  <span className="text-[11px]">{v}</span>
                </div>
              ))}
            </div>
          </details>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="glass-card">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#00D4FF]" />
            <span className="text-sm font-medium">Filters</span>
            {hasActiveFilters && (
              <Badge className="bg-[#00D4FF]/10 text-[#00D4FF] border-[#00D4FF]/25 text-[10px] ml-1">
                Active
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter by email..."
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="pl-9 bg-background/50 h-9 text-sm"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Country code (+1, +44...)"
                value={countryCodeFilter}
                onChange={(e) => setCountryCodeFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                className="pl-9 bg-background/50 h-9 text-sm"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="pl-9 bg-background/50 h-9 text-sm"
                title="From date"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="pl-9 bg-background/50 h-9 text-sm"
                title="To date"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={applyFilters} size="sm" className="bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/25 hover:bg-[#00D4FF]/20">
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Apply Filters
            </Button>
            {hasActiveFilters && (
              <Button onClick={clearFilters} size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5 mr-1.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.leads?.length ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                {hasActiveFilters ? "No leads match your filters." : "No leads yet. They will appear here when users submit the contact form."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Name</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Email</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Country</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Investment</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Message</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Source</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Date Added</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leads.map((lead: Lead) => (
                    <TableRow key={lead.id} className="border-border hover:bg-accent/30">
                      <TableCell className="font-medium text-sm">{lead.full_name}</TableCell>
                      <TableCell className="text-sm text-[#00D4FF]">
                        <a href={`mailto:${lead.email}`} className="hover:underline">
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {lead.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          {lead.country && <span className="font-medium text-xs">{lead.country}</span>}
                          {lead.country_code && (
                            <Badge variant="outline" className="text-[10px] border-border w-fit px-1.5 py-0">
                              {lead.country_code}
                            </Badge>
                          )}
                          {!lead.country && !lead.country_code && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {lead.investment_range
                          ? (
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/25 text-[10px]">
                              {INVESTMENT_RANGE_LABELS[lead.investment_range] ?? lead.investment_range}
                            </Badge>
                          )
                          : <span className="text-muted-foreground">—</span>
                        }
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {lead.message ? (
                          <p className="text-xs text-muted-foreground truncate" title={lead.message}>
                            {lead.message}
                          </p>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] border-border px-1.5 py-0">
                          {lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(lead.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLead(lead.id)}
                          disabled={deletingId === lead.id}
                          className="h-8 w-8 hover:text-red-400"
                          title="Delete lead"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage(page + 1)}
            disabled={page >= data.totalPages}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
