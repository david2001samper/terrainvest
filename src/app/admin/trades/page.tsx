"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  History,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Trade, Profile } from "@/lib/types";

export default function AdminTradesPage() {
  const [page, setPage] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Profile | null>(null);

  // Load all clients for the picker (same pattern as deposits)
  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ["admin", "clients", "trades-picker"],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients?page=1&limit=500");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ clients: Profile[] }>;
    },
  });
  const clients = clientsData?.clients ?? [];

  // Load trades — filtered by userId when a client is selected
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trades", page, selectedClient?.id ?? "all"],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (selectedClient) params.set("userId", selectedClient.id);
      const res = await fetch(`/api/admin/trades?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  function selectClient(client: Profile) {
    setSelectedClient(client);
    setPickerOpen(false);
    setPage(1);
  }

  function clearClient() {
    setSelectedClient(null);
    setPage(1);
  }

  const totalBuys  = data?.trades?.filter((t: Trade) => t.side === "buy").length  ?? 0;
  const totalSells = data?.trades?.filter((t: Trade) => t.side === "sell").length ?? 0;
  const totalPnl   = data?.trades?.reduce((sum: number, t: Trade) => sum + (Number(t.profit_loss) || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          All Platform Trades
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {selectedClient
            ? `Showing trades for ${selectedClient.display_name || selectedClient.email}`
            : `${data?.total ?? 0} total trades across all clients`}
        </p>
      </div>

      {/* Client filter — same combobox pattern as deposits */}
      <Card className="glass-card accent-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Filter by Client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger
              role="combobox"
              aria-expanded={pickerOpen}
              disabled={clientsLoading}
              className="flex w-full h-11 items-center justify-between rounded-lg border border-input bg-background/50 px-3 text-sm font-normal"
            >
              {selectedClient ? (
                <span className="truncate text-left">
                  {selectedClient.display_name || "—"}{" "}
                  <span className="text-muted-foreground">
                    ({selectedClient.email})
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">
                  All clients — search to filter…
                </span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0 z-[300]"
              align="start"
            >
              <Command>
                <CommandInput placeholder="Search name or email…" />
                <CommandList>
                  <CommandEmpty>No client found.</CommandEmpty>
                  <CommandGroup>
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.email ?? ""} ${c.display_name ?? ""}`}
                        onSelect={() => selectClient(c)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedClient?.id === c.id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="truncate">
                          {c.display_name || c.email}
                          <span className="text-muted-foreground text-xs ml-2">
                            {c.email}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedClient && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearClient}
              className="mt-2 h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3 mr-1" />
              Clear filter — show all clients
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Summary chips — only shown when a client or page of data is loaded */}
      {data?.trades?.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-background/60 border border-border text-xs">
            <span className="text-muted-foreground">Total on page: </span>
            <span className="font-semibold">{data.trades.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-green-600/10 border border-green-600/20 text-xs text-green-400">
            Buys: <span className="font-semibold">{totalBuys}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-600/20 text-xs text-red-400">
            Sells: <span className="font-semibold">{totalSells}</span>
          </div>
          <div
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              totalPnl >= 0
                ? "bg-green-600/10 border-green-600/20 text-green-400"
                : "bg-red-600/10 border-red-600/20 text-red-400"
            }`}
          >
            Page P&amp;L: {totalPnl >= 0 ? "+" : ""}
            {formatCurrency(totalPnl)}
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-background/60 border border-border text-xs">
            <span className="text-muted-foreground">Total trades: </span>
            <span className="font-semibold">{data.total}</span>
          </div>
        </div>
      )}

      {/* Trades table */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.trades?.length ? (
            <div className="p-12 text-center">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">
                {selectedClient
                  ? `No trades found for ${selectedClient.display_name || selectedClient.email}`
                  : "No trades found"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">
                      Date
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">
                      Client
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">
                      Symbol
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">
                      Side
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Qty
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Price
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Total
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      P&amp;L
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trades.map((trade: Trade) => {
                    const pnl = Number(trade.profit_loss) || 0;
                    // Find client name from our loaded list
                    const clientName =
                      clients.find((c) => c.id === trade.user_id)?.display_name ||
                      clients.find((c) => c.id === trade.user_id)?.email ||
                      trade.user_id.slice(0, 8) + "…";

                    return (
                      <TableRow
                        key={trade.id}
                        className="border-border hover:bg-accent/30"
                      >
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(trade.created_at)}
                        </TableCell>
                        <TableCell className="text-xs max-w-[140px]">
                          <span
                            className="truncate block"
                            title={clients.find((c) => c.id === trade.user_id)?.email}
                          >
                            {clientName}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {trade.symbol}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] uppercase font-bold ${
                              trade.side === "buy"
                                ? "bg-green-600/20 text-green-400 border-green-600/30"
                                : "bg-red-600/20 text-red-400 border-red-600/30"
                            }`}
                          >
                            {trade.side}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {trade.quantity.toLocaleString(undefined, {
                            maximumFractionDigits: 8,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(trade.price, trade.price < 1 ? 6 : 2)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(trade.total)}
                        </TableCell>
                        <TableCell className="text-right">
                          {trade.side === "sell" || Math.abs(pnl) > 0.0001 ? (
                            <span
                              className={`font-semibold text-sm ${
                                pnl >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {pnl >= 0 ? "+" : ""}
                              {formatCurrency(pnl)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase border-green-600/30 text-green-400"
                          >
                            {trade.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
