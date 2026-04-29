"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  ArrowDownCircle,
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  Calendar,
  Trash2,
  History,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Profile } from "@/lib/types";

type DepositRecord = {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
  user: { id: string; email: string; display_name: string | null } | null;
  created_by_profile: { display_name: string | null; email: string } | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export default function AdminDepositsPage() {
  const queryClient = useQueryClient();

  // ── Credit form state ────────────────────────────────────────────
  const [open,       setOpen]       = useState(false);
  const [selected,   setSelected]   = useState<Profile | null>(null);
  const [amount,     setAmount]     = useState("");
  const [note,       setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── History filters ──────────────────────────────────────────────
  const [searchInput,   setSearchInput]   = useState("");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedFrom,   setAppliedFrom]   = useState("");
  const [appliedTo,     setAppliedTo]     = useState("");
  const [histPage,      setHistPage]      = useState(1);

  // ── Delete dialog ────────────────────────────────────────────────
  const [deleteTarget,    setDeleteTarget]    = useState<DepositRecord | null>(null);
  const [reverseBalance,  setReverseBalance]  = useState(false);
  const [deleting,        setDeleting]        = useState(false);

  // ── Clients picker ───────────────────────────────────────────────
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["admin", "clients", "picker", 500],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients?page=1&limit=500");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ clients: Profile[] }>;
    },
    staleTime: 60_000,
  });
  const clients = clientsData?.clients ?? [];

  // ── Deposit history ──────────────────────────────────────────────
  const { data: histData, isLoading: histLoading } = useQuery({
    queryKey: ["admin", "deposit-history", appliedSearch, appliedFrom, appliedTo, histPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: histPage.toString(),
        ...(appliedSearch && { search: appliedSearch }),
        ...(appliedFrom   && { date_from: appliedFrom }),
        ...(appliedTo     && { date_to:   appliedTo }),
      });
      const res = await fetch(`/api/admin/deposit-history?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const hasFilters = appliedSearch || appliedFrom || appliedTo;

  function applyFilters() {
    setAppliedSearch(searchInput);
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
    setHistPage(1);
  }

  function clearFilters() {
    setSearchInput(""); setDateFrom(""); setDateTo("");
    setAppliedSearch(""); setAppliedFrom(""); setAppliedTo("");
    setHistPage(1);
  }

  // ── Submit credit ────────────────────────────────────────────────
  async function submit() {
    if (!selected) { toast.error("Select a client"); return; }
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) { toast.error("Enter a valid amount"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, amount: num, note: note || null }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Deposit failed"); return; }
      toast.success(
        `Credited ${formatCurrency(json.amount)} to ${selected.display_name || selected.email}. New balance: ${formatCurrency(json.newBalance)}.`
      );
      setSelected((s) => (s ? { ...s, balance: json.newBalance } : null));
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "deposit-history"] });
    } catch {
      toast.error("Deposit failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete history entry ─────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const params = new URLSearchParams({
        id:      deleteTarget.id,
        reverse: String(reverseBalance),
      });
      const res = await fetch(`/api/admin/deposit-history?${params}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed"); }
      toast.success(reverseBalance ? "Record removed and balance reversed" : "Record removed");
      setDeleteTarget(null);
      setReverseBalance(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "deposit-history"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Credit form ── */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownCircle className="w-6 h-6 text-[#00D4FF]" />
          Deposits
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Credit a client's balance and track all deposit history below.
        </p>
      </div>

      <Card className="glass-card accent-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Credit deposit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Client picker */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Client</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                role="combobox"
                aria-expanded={open}
                disabled={clientsLoading}
                className="flex w-full h-11 items-center justify-between rounded-lg border border-input bg-background/50 px-3 text-sm font-normal"
              >
                {selected ? (
                  <span className="truncate text-left">
                    {selected.display_name || "—"}{" "}
                    <span className="text-muted-foreground">({selected.email})</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search and select client…</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[300]" align="start">
                <Command>
                  <CommandInput placeholder="Search name or email…" />
                  <CommandList>
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.email ?? ""} ${c.display_name ?? ""}`}
                          onSelect={() => { setSelected(c); setOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selected?.id === c.id ? "opacity-100" : "opacity-0")} />
                          <span className="truncate">
                            {c.display_name || c.email}
                            <span className="text-muted-foreground text-xs ml-2">{c.email}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Current balance: {formatCurrency(selected.balance)}
              </p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Amount to credit (USD)</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000.00"
              className="bg-background/50 h-11"
            />
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Note <span className="text-muted-foreground/60">(optional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Wire transfer, crypto deposit, bonus credit…"
              className="bg-background/50 min-h-[70px] resize-none text-sm"
            />
          </div>

          <Button
            onClick={submit}
            disabled={submitting || !selected}
            className="w-full h-11 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
          >
            {submitting
              ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
              : <ArrowDownCircle className="w-4 h-4 mr-2" />}
            Credit account
          </Button>
        </CardContent>
      </Card>

      {/* ── Deposit history ── */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-muted-foreground" />
          Deposit History
          {histData?.total !== undefined && (
            <Badge variant="outline" className="border-border text-muted-foreground text-xs ml-1">
              {histData.total} records
            </Badge>
          )}
        </h2>

        {/* Filters */}
        <Card className="glass-card mb-4">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
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
                Apply
              </Button>
              {hasFilters && (
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
            {histLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !histData?.history?.length ? (
              <div className="py-14 text-center">
                <History className="w-9 h-9 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm">
                  {hasFilters ? "No records match your filters." : "No deposits recorded yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-[11px] uppercase text-muted-foreground">Client</TableHead>
                      <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-[11px] uppercase text-muted-foreground">Note</TableHead>
                      <TableHead className="text-[11px] uppercase text-muted-foreground">Credited by</TableHead>
                      <TableHead className="text-[11px] uppercase text-muted-foreground">Date</TableHead>
                      <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {histData.history.map((row: DepositRecord) => (
                      <TableRow key={row.id} className="border-border hover:bg-accent/30">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {row.user?.display_name || "—"}
                            </p>
                            <p className="text-xs text-[#00D4FF]">{row.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-green-400">
                            +{formatCurrency(row.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {row.note ? (
                            <p className="text-xs text-muted-foreground truncate" title={row.note}>
                              {row.note}
                            </p>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.created_by_profile?.display_name || row.created_by_profile?.email || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(row.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:text-red-400"
                            title="Remove record"
                            onClick={() => { setDeleteTarget(row); setReverseBalance(false); }}
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
        {histData && histData.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="outline" size="icon" onClick={() => setHistPage(histPage - 1)} disabled={histPage <= 1} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {histPage} of {histData.totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={() => setHistPage(histPage + 1)} disabled={histPage >= histData.totalPages} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setReverseBalance(false); } }}>
        <DialogContent className="glass-card accent-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove deposit record</DialogTitle>
          </DialogHeader>

          {deleteTarget && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl bg-background/50 border border-border p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{deleteTarget.user?.display_name || deleteTarget.user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold text-green-400">+{formatCurrency(deleteTarget.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{formatDateTime(deleteTarget.created_at)}</span>
                </div>
                {deleteTarget.note && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Note</span>
                    <span className="text-right text-xs">{deleteTarget.note}</span>
                  </div>
                )}
              </div>

              {/* Reverse toggle */}
              <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-border bg-background/50 p-4 hover:bg-accent/30 transition-colors">
                <input
                  type="checkbox"
                  checked={reverseBalance}
                  onChange={(e) => setReverseBalance(e.target.checked)}
                  className="mt-0.5 rounded border-border accent-red-500 w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium">Also reverse the balance</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deducts {formatCurrency(deleteTarget.amount)} from{" "}
                    {deleteTarget.user?.display_name || "this client"}&apos;s account balance.
                    Leave unchecked to only remove the history entry.
                  </p>
                </div>
              </label>

              {reverseBalance && (
                <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
                  The client's balance will be reduced by {formatCurrency(deleteTarget.amount)}. This cannot be undone.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setReverseBalance(false); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              className={reverseBalance
                ? "bg-red-500 hover:bg-red-600 text-white font-semibold"
                : "bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"}
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {reverseBalance ? "Remove & Reverse Balance" : "Remove Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
