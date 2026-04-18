"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Shield, Search, Loader2 } from "lucide-react";

interface PermClient {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  can_trade_crypto: boolean;
  can_trade_stocks: boolean;
  can_trade_indexes: boolean;
  can_trade_commodities: boolean;
  can_trade_forex: boolean;
  can_trade_options: boolean;
  can_view_order_book: boolean;
  max_leverage: number;
}

const PERM_COLS = [
  { key: "can_trade_crypto", label: "Crypto" },
  { key: "can_trade_stocks", label: "Stocks" },
  { key: "can_trade_indexes", label: "Indexes" },
  { key: "can_trade_commodities", label: "Commodities" },
  { key: "can_trade_forex", label: "Forex" },
  { key: "can_trade_options", label: "Options" },
  { key: "can_view_order_book", label: "Order Book" },
] as const;

const LEVERAGE_OPTIONS = [1, 5, 10, 25, 50, 100];

export default function AdminPermissionsPage() {
  const [clients, setClients] = useState<PermClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  async function fetchClients() {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/permissions${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => fetchClients(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function togglePerm(client: PermClient, field: string) {
    const prev = client[field as keyof PermClient] as boolean;
    setClients((c) =>
      c.map((cl) =>
        cl.id === client.id ? { ...cl, [field]: !prev } : cl
      )
    );
    setUpdating((u) => ({ ...u, [client.id]: true }));
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: client.id, [field]: !prev }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setClients((c) =>
        c.map((cl) =>
          cl.id === client.id ? { ...cl, [field]: prev } : cl
        )
      );
      toast.error("Failed to update permission");
    } finally {
      setUpdating((u) => ({ ...u, [client.id]: false }));
    }
  }

  async function setLeverage(client: PermClient, lev: number) {
    const prev = client.max_leverage;
    setClients((c) =>
      c.map((cl) =>
        cl.id === client.id ? { ...cl, max_leverage: lev } : cl
      )
    );
    setUpdating((u) => ({ ...u, [client.id]: true }));
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: client.id, max_leverage: lev }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setClients((c) =>
        c.map((cl) =>
          cl.id === client.id ? { ...cl, max_leverage: prev } : cl
        )
      );
      toast.error("Failed to update leverage");
    } finally {
      setUpdating((u) => ({ ...u, [client.id]: false }));
    }
  }

  function toggleAll(client: PermClient, enable: boolean) {
    const updates: Record<string, boolean> = {};
    for (const col of PERM_COLS) updates[col.key] = enable;
    setClients((c) =>
      c.map((cl) =>
        cl.id === client.id ? { ...cl, ...updates } : cl
      )
    );
    setUpdating((u) => ({ ...u, [client.id]: true }));
    fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: client.id, ...updates }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
      })
      .catch(() => {
        fetchClients();
        toast.error("Failed to update");
      })
      .finally(() => setUpdating((u) => ({ ...u, [client.id]: false })));
  }

  const userClients = clients.filter((c) => c.role !== "admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-[#00D4FF]" />
          Trading Permissions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Enable or disable trading access per client and set max leverage
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background/50 border-border focus:border-[#00D4FF] h-10"
        />
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Client Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : userClients.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No clients found</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground min-w-[180px]">Client</TableHead>
                    {PERM_COLS.map((col) => (
                      <TableHead key={col.key} className="text-[11px] uppercase text-muted-foreground text-center">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-center min-w-[120px]">
                      Max Leverage
                    </TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground text-center">
                      Quick
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userClients.map((client) => {
                    const allOn = PERM_COLS.every(
                      (c) => client[c.key as keyof PermClient]
                    );
                    return (
                      <TableRow key={client.id} className="border-border hover:bg-accent/30">
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">
                              {client.display_name || "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {client.email}
                            </p>
                          </div>
                        </TableCell>
                        {PERM_COLS.map((col) => {
                          const val = client[col.key as keyof PermClient] as boolean;
                          return (
                            <TableCell key={col.key} className="text-center">
                              <button
                                onClick={() => togglePerm(client, col.key)}
                                disabled={!!updating[client.id]}
                                className={`w-10 h-5 rounded-full transition-colors relative ${
                                  val
                                    ? "bg-green-500"
                                    : "bg-gray-600"
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                                    val ? "left-5" : "left-0.5"
                                  }`}
                                />
                              </button>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <Select
                            value={String(client.max_leverage)}
                            onValueChange={(v) =>
                              setLeverage(client, parseInt(v ?? "1", 10))
                            }
                          >
                            <SelectTrigger className="h-8 w-24 mx-auto bg-background/50 border-border text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEVERAGE_OPTIONS.map((lev) => (
                                <SelectItem key={lev} value={String(lev)}>
                                  {lev}:1
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {updating[client.id] ? (
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] px-2"
                                onClick={() => toggleAll(client, !allOn)}
                              >
                                {allOn ? "Disable All" : "Enable All"}
                              </Button>
                            )}
                          </div>
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
    </div>
  );
}
