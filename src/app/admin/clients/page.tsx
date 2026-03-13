"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Users,
  Search,
  Edit,
  ChevronLeft,
  ChevronRight,
  Download,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

export default function AdminClientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editClient, setEditClient] = useState<Profile | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [editPnl, setEditPnl] = useState("");
  const [editVip, setEditVip] = useState("");
  const [activityMap, setActivityMap] = useState<Record<string, { trade_count: number; avg_trade_size: number; last_login_at: string | null }>>({});
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "clients", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ search, page: page.toString(), limit: "20" });
      const res = await fetch(`/api/admin/clients?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (!data?.clients?.length) return;
    data.clients.forEach((c: Profile) => {
      fetch(`/api/admin/user-activity?userId=${c.id}`)
        .then((r) => r.json())
        .then((act) => {
          setActivityMap((prev) => ({
            ...prev,
            [c.id]: {
              trade_count: act.trade_count ?? 0,
              avg_trade_size: act.avg_trade_size ?? 0,
              last_login_at: act.last_login_at ?? null,
            },
          }));
        })
        .catch(() => {});
    });
  }, [data?.clients]);

  function openEdit(client: Profile) {
    setEditClient(client);
    setEditBalance(client.balance.toString());
    setEditPnl(client.total_pnl.toString());
    setEditVip(client.vip_level.toString());
  }

  async function saveEdit() {
    if (!editClient) return;
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editClient.id,
          balance: parseFloat(editBalance),
          total_pnl: parseFloat(editPnl),
          vip_level: parseInt(editVip),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Client updated successfully");
      setEditClient(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    } catch {
      toast.error("Failed to update client");
    }
  }

  function exportCSV() {
    if (!data?.clients) return;
    const headers = "Email,Name,Balance,P&L,VIP Level,Role,Created\n";
    const rows = data.clients
      .map(
        (c: Profile) =>
          `${c.email},${c.display_name},${c.balance},${c.total_pnl},${c.vip_level},${c.role},${c.created_at}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clients.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-400" />
            Client Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.total || 0} total clients
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCSV}
          className="accent-border"
          disabled={!data?.clients?.length}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10 bg-background/50 border-border focus:border-[#00D4FF] h-10"
        />
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Client</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Role</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Balance</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">P&L</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">VIP</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Activity</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Joined</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.clients?.map((client: Profile) => (
                    <TableRow key={client.id} className="border-border hover:bg-accent/30">
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{client.display_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{client.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] uppercase ${
                            client.role === "admin"
                              ? "bg-red-500/20 text-red-400 border-red-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          }`}
                        >
                          {client.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(client.balance)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          client.total_pnl >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {client.total_pnl >= 0 ? "+" : ""}
                        {formatCurrency(client.total_pnl)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="border-[#00D4FF]/30 text-[#00D4FF] text-[10px]">
                          Level {client.vip_level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {activityMap[client.id] ? (
                          <div className="text-xs">
                            <p>{activityMap[client.id].trade_count} trades</p>
                            <p>Avg: {formatCurrency(activityMap[client.id].avg_trade_size)}</p>
                            <p>Last: {activityMap[client.id].last_login_at ? formatDate(activityMap[client.id].last_login_at as string) : "—"}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(client.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-[#00D4FF] mr-1">
                            <Wallet className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(client)}
                          className="h-8 w-8 hover:text-[#00D4FF]"
                        >
                          <Edit className="w-4 h-4" />
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

      {/* Edit Dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent className="glass-card accent-border">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          {editClient && (
            <div className="space-y-4">
              <div>
                <p className="font-medium">{editClient.display_name}</p>
                <p className="text-sm text-muted-foreground">{editClient.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Balance (USD)</Label>
                <Input
                  type="number"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Total P&L (USD)</Label>
                <Input
                  type="number"
                  value={editPnl}
                  onChange={(e) => setEditPnl(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">VIP Level</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={editVip}
                  onChange={(e) => setEditVip(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditClient(null)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveEdit}
                  className="flex-1 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
