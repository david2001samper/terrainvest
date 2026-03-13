"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Layers, Plus, Loader2 } from "lucide-react";
import type { Asset } from "@/lib/types";

export default function AdminAssetsPage() {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("stock");
  const [adding, setAdding] = useState(false);
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ["admin", "assets"],
    queryFn: async () => {
      const res = await fetch("/api/admin/assets");
      if (!res.ok) return [];
      return res.json();
    },
  });

  async function addAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || !name) {
      toast.error("Symbol and name are required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: symbol.toUpperCase(), name, asset_type: assetType }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast.success("Asset added successfully");
      setSymbol("");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add asset");
    } finally {
      setAdding(false);
    }
  }

  const typeColors: Record<string, string> = {
    crypto: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    stock: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    commodity: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    index: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="w-6 h-6 text-green-400" />
          Asset Management
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add and manage tradeable assets
        </p>
      </div>

      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base">Add New Asset</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addAsset} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input
                placeholder="e.g. AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="bg-background/50 mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                placeholder="e.g. Apple Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/50 mt-1"
              />
            </div>
            <div className="w-40">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v ?? "stock")}>
                <SelectTrigger className="bg-background/50 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="commodity">Commodity</SelectItem>
                  <SelectItem value="index">Index</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={adding}
                className="bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold h-10"
              >
                {adding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">
            All Assets ({assets?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Name</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Type</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="text-[11px] uppercase text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {assets?.map((asset) => (
                  <TableRow key={asset.id} className="border-border hover:bg-accent/30">
                    <TableCell className="font-medium">{asset.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {(asset as { display_name?: string }).display_name || asset.name}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] uppercase ${typeColors[asset.asset_type] || ""}`}>
                        {asset.asset_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          asset.is_active
                            ? "border-green-600/30 text-green-400"
                            : "border-red-600/30 text-red-400"
                        }`}
                      >
                        {asset.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const name = prompt("Display name", (asset as { display_name?: string }).display_name || asset.name);
                          if (name != null) {
                            fetch(`/api/admin/assets/${asset.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ display_name: name || asset.name }),
                            }).then((r) => {
                              if (r.ok) {
                                toast.success("Updated");
                                queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
                              }
                            });
                          }
                        }}
                      >
                        Edit
                      </Button>
                      {asset.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          onClick={() => {
                            if (confirm("Deactivate this asset?")) {
                              fetch(`/api/admin/assets/${asset.id}`, { method: "DELETE" }).then((r) => {
                                if (r.ok) {
                                  toast.success("Asset deactivated");
                                  queryClient.invalidateQueries({ queryKey: ["admin", "assets"] });
                                }
                              });
                            }
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
