"use client";

import { useState, useEffect, type ReactNode } from "react";
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
  Lock,
  Unlock,
  Trash2,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/types";

function yesNo(v: boolean | undefined | null) {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-all">{value ?? "—"}</p>
    </div>
  );
}

export default function AdminClientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editClient, setEditClient] = useState<Profile | null>(null);
  const [editBalance, setEditBalance] = useState("");
  const [editPnl, setEditPnl] = useState("");
  const [editVip, setEditVip] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editPreferredCurrency, setEditPreferredCurrency] = useState("");
  const [passwordReset, setPasswordReset] = useState("");
  const [editLocked, setEditLocked] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [infoClient, setInfoClient] = useState<Profile | null>(null);
  type LoginEntry = { at: string; ip: string | null; ua: string | null };
  type ActivityEntry = {
    trade_count: number;
    avg_trade_size: number;
    last_login_at: string | null;
    auth_last_sign_in_at: string | null;
    recent_logins: LoginEntry[];
  };
  const [activityMap, setActivityMap] = useState<Record<string, ActivityEntry>>({});
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
    data.clients.forEach((c: Profile & { auth_last_sign_in_at?: string | null }) => {
      fetch(`/api/admin/user-activity?userId=${c.id}`)
        .then((r) => r.json())
        .then((act) => {
          // Pick the most recent login timestamp across all sources.
          const candidates = [
            act.last_login_at,
            act.auth_last_sign_in_at,
            c.auth_last_sign_in_at,
          ].filter(Boolean) as string[];
          const bestLogin = candidates.length
            ? candidates.reduce((a, b) => (a > b ? a : b))
            : null;

          setActivityMap((prev) => ({
            ...prev,
            [c.id]: {
              trade_count: act.trade_count ?? 0,
              avg_trade_size: act.avg_trade_size ?? 0,
              last_login_at: bestLogin,
              auth_last_sign_in_at: act.auth_last_sign_in_at ?? null,
              recent_logins: act.recent_logins ?? [],
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
    setEditLocked(client.is_locked ?? false);
    setEditName(client.display_name ?? "");
    setEditEmail(client.email);
    setEditRole(client.role);
    setEditPreferredCurrency(client.preferred_currency ?? "");
    setPasswordReset("");
  }

  async function toggleLock(client: Profile) {
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: client.id,
          is_locked: !(client.is_locked ?? false),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(client.is_locked ? "Account unlocked" : "Account locked");
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    } catch {
      toast.error("Failed to update");
    }
  }

  async function deleteClient(client: Profile) {
    if (!confirm(`Permanently delete ${client.email}? This cannot be undone.`)) return;
    if (client.role === "admin") {
      toast.error("Cannot delete admin accounts");
      return;
    }
    setDeleting(client.id);
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/delete`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      toast.success("Account deleted");
      setEditClient(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleting(null);
    }
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
          is_locked: editLocked,
          display_name: editName,
          email: editEmail,
          role: editRole,
          preferred_currency: editPreferredCurrency || null,
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
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Status</TableHead>
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
                        {client.is_locked ? (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">Locked</Badge>
                        ) : (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Active</Badge>
                        )}
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
                          <div className="text-xs space-y-0.5">
                            <p>{activityMap[client.id].trade_count} trades</p>
                            <p>Avg: {formatCurrency(activityMap[client.id].avg_trade_size)}</p>
                            <p className="font-medium text-foreground">
                              Last login:{" "}
                              {activityMap[client.id].last_login_at
                                ? formatDate(activityMap[client.id].last_login_at as string)
                                : "Never"}
                            </p>
                            {activityMap[client.id].recent_logins?.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {activityMap[client.id].recent_logins
                                  .slice(0, 3)
                                  .map((entry, i) => (
                                    <p key={i} className="text-[10px] text-muted-foreground">
                                      {formatDate(entry.at)}
                                      {entry.ip && (
                                        <span className="ml-1 font-mono text-[#00D4FF]/70">
                                          {entry.ip}
                                        </span>
                                      )}
                                    </p>
                                  ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Loading…</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(client.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setInfoClient(client)}
                          className="h-8 w-8 hover:text-[#00D4FF] mr-1"
                          title="Client details"
                        >
                          <UserCircle className="w-4 h-4" />
                        </Button>
                        <Link href={`/admin/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-[#00D4FF] mr-1">
                            <Wallet className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(client)}
                          className="h-8 w-8 hover:text-[#00D4FF] mr-1"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleLock(client)}
                          className={`h-8 w-8 mr-1 ${client.is_locked ? "hover:text-green-400" : "hover:text-amber-400"}`}
                          title={client.is_locked ? "Unlock" : "Lock"}
                        >
                          {client.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </Button>
                        {client.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteClient(client)}
                            disabled={deleting === client.id}
                            className="h-8 w-8 hover:text-red-400"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
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

      <Dialog open={!!infoClient} onOpenChange={(open) => !open && setInfoClient(null)}>
        <DialogContent className="glass-card accent-border max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Client details</DialogTitle>
          </DialogHeader>
          {infoClient && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow label="User ID" value={infoClient.id} />
                <DetailRow label="Email" value={infoClient.email} />
                <DetailRow label="Display name" value={infoClient.display_name || "—"} />
                <DetailRow
                  label="Phone (E.164)"
                  value={infoClient.phone_e164?.trim() ? infoClient.phone_e164 : "—"}
                />
                <DetailRow label="Role" value={infoClient.role} />
                <DetailRow label="VIP level" value={String(infoClient.vip_level)} />
                <DetailRow label="Balance" value={formatCurrency(infoClient.balance)} />
                <DetailRow label={"Total P&L"} value={formatCurrency(infoClient.total_pnl)} />
                <DetailRow label="Preferred currency" value={infoClient.preferred_currency || "—"} />
                <DetailRow label="Account locked" value={yesNo(infoClient.is_locked)} />
                <DetailRow
                  label="Joined"
                  value={infoClient.created_at ? formatDate(infoClient.created_at) : "—"}
                />
                <DetailRow
                  label="Last updated"
                  value={infoClient.updated_at ? formatDate(infoClient.updated_at) : "—"}
                />
                <DetailRow
                  label="Last login (profile)"
                  value={infoClient.last_login_at ? formatDate(infoClient.last_login_at) : "—"}
                />
                <DetailRow
                  label="Avatar URL"
                  value={infoClient.avatar_url?.trim() ? infoClient.avatar_url : "—"}
                />
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Notifications
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <span className="text-muted-foreground">Withdrawal alerts</span>
                  <span>{yesNo(infoClient.notify_withdrawal)}</span>
                  <span className="text-muted-foreground">Deposit alerts</span>
                  <span>{yesNo(infoClient.notify_deposit)}</span>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Trading permissions
                </p>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <span className="text-muted-foreground">Crypto</span>
                  <span>{yesNo(infoClient.can_trade_crypto)}</span>
                  <span className="text-muted-foreground">Stocks</span>
                  <span>{yesNo(infoClient.can_trade_stocks)}</span>
                  <span className="text-muted-foreground">Indexes</span>
                  <span>{yesNo(infoClient.can_trade_indexes)}</span>
                  <span className="text-muted-foreground">Commodities</span>
                  <span>{yesNo(infoClient.can_trade_commodities)}</span>
                  <span className="text-muted-foreground">Forex</span>
                  <span>{yesNo(infoClient.can_trade_forex)}</span>
                  <span className="text-muted-foreground">Options</span>
                  <span>{yesNo(infoClient.can_trade_options)}</span>
                  <span className="text-muted-foreground">Max leverage</span>
                  <span>{infoClient.max_leverage != null ? String(infoClient.max_leverage) : "—"}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/clients/${infoClient.id}`} onClick={() => setInfoClient(null)}>
                  <Button variant="outline" size="sm" className="accent-border">
                    <Wallet className="w-4 h-4 mr-2" />
                    Open portfolio
                  </Button>
                </Link>
                <Button variant="outline" size="sm" onClick={() => setInfoClient(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                <Label className="text-sm text-muted-foreground">Name</Label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="bg-background/50"
                />
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
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Role</Label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                  className="bg-background/50 border border-border rounded-md px-3 py-2 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preferred Currency</Label>
                <Input
                  type="text"
                  value={editPreferredCurrency}
                  onChange={(e) => setEditPreferredCurrency(e.target.value)}
                  placeholder="e.g. USD, EUR"
                  className="bg-background/50"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editLocked"
                  checked={editLocked}
                  onChange={(e) => setEditLocked(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="editLocked" className="text-sm">Lock account (blocks trading)</Label>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <Label className="text-sm text-muted-foreground">Reset Password</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={passwordReset}
                    onChange={(e) => setPasswordReset(e.target.value)}
                    placeholder="New password (min 6 chars)"
                    className="bg-background/50"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!passwordReset || passwordReset.length < 6}
                    onClick={async () => {
                      if (!editClient) return;
                      try {
                        const res = await fetch(`/api/admin/clients/${editClient.id}/password`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ password: passwordReset }),
                        });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Failed");
                        toast.success("Password updated");
                        setPasswordReset("");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to reset password");
                      }
                    }}
                  >
                    Update
                  </Button>
                </div>
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
