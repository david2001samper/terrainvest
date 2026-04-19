"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { ArrowDownCircle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { Profile } from "@/lib/types";

export default function AdminDepositsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    // Shared key with the trades page picker — both fetch the same list,
    // so React Query dedupes and reuses the cached result.
    queryKey: ["admin", "clients", "picker", 500],
    queryFn: async () => {
      const res = await fetch("/api/admin/clients?page=1&limit=500");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ clients: Profile[] }>;
    },
    staleTime: 60_000,
  });

  const clients = data?.clients ?? [];

  async function submit() {
    if (!selected) {
      toast.error("Select a client");
      return;
    }
    const num = parseFloat(amount);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, amount: num }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Deposit failed");
        return;
      }
      toast.success(
        `Credited ${formatCurrency(json.amount)} to ${selected.display_name || selected.email}. New balance: ${formatCurrency(json.newBalance)}.`
      );
      setSelected((s) => (s ? { ...s, balance: json.newBalance } : null));
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin", "clients"] });
    } catch {
      toast.error("Deposit failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowDownCircle className="w-6 h-6 text-[#00D4FF]" />
          Credit deposit
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Add funds to a client&apos;s balance. They receive an in-app notification (and a desktop alert if enabled).
        </p>
      </div>

      <Card className="glass-card accent-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Record deposit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Client</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger
                role="combobox"
                aria-expanded={open}
                disabled={isLoading}
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
                          onSelect={() => {
                            setSelected(c);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selected?.id === c.id ? "opacity-100" : "opacity-0"
                            )}
                          />
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

          <Button
            onClick={submit}
            disabled={submitting || !selected}
            className="w-full h-11 bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowDownCircle className="w-4 h-4 mr-2" />
            )}
            Credit account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
