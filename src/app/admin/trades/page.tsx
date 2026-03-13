"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
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
import { History, ChevronLeft, ChevronRight } from "lucide-react";
import type { Trade } from "@/lib/types";

export default function AdminTradesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "trades", page],
    queryFn: async () => {
      const res = await fetch(`/api/admin/trades?page=${page}&limit=50`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-purple-400" />
          All Platform Trades
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.total || 0} total trades across all users
        </p>
      </div>

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
              <p className="text-muted-foreground">No trades found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Date</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">User ID</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Side</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.trades.map((trade: Trade) => (
                    <TableRow key={trade.id} className="border-border hover:bg-accent/30">
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(trade.created_at)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {trade.user_id.slice(0, 8)}...
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
                        <Badge variant="outline" className="text-[10px] uppercase border-green-600/30 text-green-400">
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
