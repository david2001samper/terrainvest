"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowUpCircle, Check, X, Loader2 } from "lucide-react";

export default function AdminWithdrawalsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "withdrawals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/withdrawals");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  async function handleAction(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(action === "approve" ? "Withdrawal approved" : "Withdrawal rejected");
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const requests = data?.requests ?? [];
  const pending = requests.filter((r: { status: string }) => r.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpCircle className="w-6 h-6 text-[#00D4FF]" />
          Withdrawal Requests
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pending.length} pending • {requests.length} total
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">All Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <Skeleton className="h-24 w-full" />
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No withdrawal requests yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase text-muted-foreground">User</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Amount</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Method</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Destination / Wallet</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Balance</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Date</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r: {
                  id: string;
                  user_email?: string;
                  user_name?: string;
                  user_balance?: number;
                  amount: number;
                  method: string;
                  status: string;
                  created_at: string;
                  wallet_address?: string | null;
                  bank_details?: {
                    label?: string | null;
                    bank_name?: string;
                    account_holder_name?: string;
                    account_number_or_iban?: string;
                    routing_number?: string | null;
                    swift_bic?: string | null;
                    country?: string | null;
                  } | null;
                }) => (
                  <TableRow key={r.id} className="border-border hover:bg-accent/30">
                    <TableCell>
                      <p className="font-medium text-sm">{r.user_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{r.user_email}</p>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(r.amount)}</TableCell>
                    <TableCell className="uppercase text-xs">{r.method}</TableCell>
                    <TableCell className="max-w-[280px] align-top">
                      {r.method === "bank" && r.bank_details ? (
                        <div className="text-xs space-y-0.5 break-words">
                          {r.bank_details.label && (
                            <p className="font-medium text-foreground">{r.bank_details.label}</p>
                          )}
                          <p>
                            <span className="text-muted-foreground">Bank:</span> {r.bank_details.bank_name}
                          </p>
                          <p>
                            <span className="text-muted-foreground">Holder:</span>{" "}
                            {r.bank_details.account_holder_name}
                          </p>
                          <p className="font-mono">
                            <span className="text-muted-foreground font-sans">Acct/IBAN:</span>{" "}
                            {r.bank_details.account_number_or_iban}
                          </p>
                          {r.bank_details.routing_number && (
                            <p>
                              <span className="text-muted-foreground">Routing:</span>{" "}
                              {r.bank_details.routing_number}
                            </p>
                          )}
                          {r.bank_details.swift_bic && (
                            <p>
                              <span className="text-muted-foreground">SWIFT:</span> {r.bank_details.swift_bic}
                            </p>
                          )}
                          {r.bank_details.country && (
                            <p>
                              <span className="text-muted-foreground">Country:</span> {r.bank_details.country}
                            </p>
                          )}
                        </div>
                      ) : r.wallet_address ? (
                        <span className="font-mono text-xs break-all" title={r.wallet_address}>
                          {r.wallet_address}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(r.user_balance ?? 0)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${
                          r.status === "pending"
                            ? "bg-amber-500/20 text-amber-400"
                            : r.status === "approved"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "pending" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-green-400 hover:bg-green-500/10"
                            onClick={() => handleAction(r.id, "approve")}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-400 hover:bg-red-500/10"
                            onClick={() => handleAction(r.id, "reject")}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
