"use client";

import { useState } from "react";
import { useTrades } from "@/hooks/use-positions";
import { useProfile } from "@/hooks/use-profile";
import { usePositions } from "@/hooks/use-positions";
import { useMarketData } from "@/hooks/use-market-data";
import { formatDate } from "@/lib/format";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { History, Search, Filter, Download } from "lucide-react";
import { toast } from "sonner";

function escapeCsv(val: string | number): string {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function HistoryPage() {
  const { format: formatCurrency, convert } = useCurrencyFormat();
  const { data: trades, isLoading } = useTrades(200);
  const { data: profile } = useProfile();
  const { data: positions } = usePositions();
  const { allAssets } = useMarketData();
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");

  const filtered = trades?.filter((t) => {
    const matchSearch = t.symbol.toLowerCase().includes(search.toLowerCase());
    const matchSide = sideFilter === "all" || t.side === sideFilter;
    return matchSearch && matchSide;
  }) || [];

  function exportTransactionHistory() {
    const headers = ["Date", "Symbol", "Side", "Quantity", "Price", "Total", "Status"];
    const rows = filtered.map((t) => [
      formatDate(t.created_at),
      t.symbol,
      t.side,
      t.quantity,
      convert(t.price),
      convert(t.total),
      t.status,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terra-invest-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Transaction history exported");
  }

  function exportBalanceGainsStatement() {
    const totalPositionValue =
      positions?.reduce((sum, p) => {
        const price = allAssets.find((a) => a.symbol === p.symbol)?.price ?? p.entry_price;
        return sum + p.quantity * price;
      }, 0) ?? 0;
    const balance = profile?.balance ?? 0;
    const totalPnl = profile?.total_pnl ?? 0;
    const portfolioValue = balance + totalPositionValue;

    const summary: (string | (string | number)[])[] = [
      ["Terra Invest VIP - Balance & Gains Statement"],
      ["Generated", new Date().toISOString()],
      [],
      ["Summary"],
      ["Current Balance (Cash)", convert(balance)],
      ["Position Value", convert(totalPositionValue)],
      ["Portfolio Value", convert(portfolioValue)],
      ["Realized P&L (Total)", convert(totalPnl)],
      [],
      ["Transaction History"],
      ["Date", "Symbol", "Side", "Quantity", "Price", "Total", "Status"],
      ...filtered.map((t) => [
        formatDate(t.created_at),
        t.symbol,
        t.side,
        t.quantity,
        convert(t.price),
        convert(t.total),
        t.status,
      ]),
    ];
    const csv = summary.map((row) => (Array.isArray(row) ? row.map(escapeCsv).join(",") : row)).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terra-invest-balance-gains-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Balance & gains statement exported");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-[#00D4FF]" />
          Trade History
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Complete record of all your transactions
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-background/50 border-border focus:border-[#00D4FF] h-10"
          />
        </div>
        <Select value={sideFilter} onValueChange={(v) => setSideFilter(v ?? "all")}>
          <SelectTrigger className="w-36 bg-background/50 border-border h-10">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trades</SelectItem>
            <SelectItem value="buy">Buy Only</SelectItem>
            <SelectItem value="sell">Sell Only</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportTransactionHistory} className="h-10">
            <Download className="w-4 h-4 mr-2" />
            Export Transactions
          </Button>
          <Button variant="outline" size="sm" onClick={exportBalanceGainsStatement} className="h-10">
            <Download className="w-4 h-4 mr-2" />
            Balance & Gains
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} Trade{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No trades found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Side</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((trade) => (
                    <TableRow key={trade.id} className="border-border hover:bg-accent/30">
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(trade.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{trade.symbol}</TableCell>
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
                        {trade.quantity.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trade.price, trade.price < 1 ? 6 : 2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(trade.total)}
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
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
