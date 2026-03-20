"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { useCurrencyFormat } from "@/hooks/use-currency-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpCircle,
  Bitcoin,
  DollarSign,
  Building2,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type BankAccount = {
  id: string;
  label: string | null;
  bank_name: string;
  account_holder_name: string;
  account_number_or_iban: string;
  routing_number: string | null;
  swift_bic: string | null;
  country: string | null;
};

export default function WithdrawalsPage() {
  const [method, setMethod] = useState<"btc" | "usdt" | "bank">("btc");
  const [amount, setAmount] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [bankSource, setBankSource] = useState<"saved" | "new">("saved");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [swiftBic, setSwiftBic] = useState("");
  const [bankCountry, setBankCountry] = useState("");
  const [bankLabel, setBankLabel] = useState("");
  const [saveBankForNext, setSaveBankForNext] = useState(true);

  const queryClient = useQueryClient();
  const { format: formatCurrency } = useCurrencyFormat();
  const { data: profile } = useProfile();

  const { data: bankAccounts = [], isLoading: banksLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.accounts ?? []) as BankAccount[];
    },
  });

  useEffect(() => {
    if (method !== "bank") return;
    if (bankAccounts.length === 0) {
      setBankSource("new");
      setSelectedBankId("");
    } else if (!selectedBankId && bankSource === "saved") {
      setSelectedBankId(bankAccounts[0].id);
    }
  }, [method, bankAccounts, bankSource, selectedBankId]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["withdrawal-requests"],
    queryFn: async () => {
      const res = await fetch("/api/withdrawals");
      if (!res.ok) return [];
      const data = await res.json();
      return data.requests ?? [];
    },
  });

  async function deleteBankAccount(id: string) {
    try {
      const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Saved bank removed");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      if (selectedBankId === id) setSelectedBankId("");
    } catch {
      toast.error("Could not remove bank account");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const balance = profile?.balance ?? 0;
    if (amt > balance) {
      toast.error("Insufficient balance");
      return;
    }
    if ((method === "btc" || method === "usdt") && !walletAddress.trim()) {
      toast.error("Enter your wallet address");
      return;
    }

    if (method === "bank") {
      if (bankSource === "saved") {
        if (!selectedBankId) {
          toast.error("Select a saved bank account or add new details");
          return;
        }
      } else {
        if (!bankName.trim() || !accountHolder.trim() || !accountNumber.trim()) {
          toast.error("Fill in bank name, account holder, and account number / IBAN");
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        amount: amt,
        method,
        wallet_address: walletAddress.trim() || undefined,
      };

      if (method === "bank") {
        if (bankSource === "saved") {
          body.bank_account_id = selectedBankId;
        } else {
          body.bank_name = bankName.trim();
          body.account_holder_name = accountHolder.trim();
          body.account_number_or_iban = accountNumber.trim();
          body.routing_number = routingNumber.trim() || undefined;
          body.swift_bic = swiftBic.trim() || undefined;
          body.country = bankCountry.trim() || undefined;
          body.bank_label = bankLabel.trim() || undefined;
          body.save_bank_account = saveBankForNext;
        }
      }

      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (method === "bank") {
        toast.success(
          "Withdrawal request submitted. Our support team will contact you shortly to complete your bank transfer."
        );
        if (bankSource === "new" && saveBankForNext) {
          queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
          setBankName("");
          setAccountHolder("");
          setAccountNumber("");
          setRoutingNumber("");
          setSwiftBic("");
          setBankCountry("");
          setBankLabel("");
        }
      } else {
        toast.success("Withdrawal request submitted. It is pending and will be released after review.");
      }

      setAmount("");
      setWalletAddress("");
      queryClient.invalidateQueries({ queryKey: ["withdrawal-requests"] });
      setSubmitting(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setSubmitting(false);
    }
  }

  const bankSubmitDisabled =
    submitting ||
    !amount ||
    (method === "bank" &&
      ((bankSource === "saved" && (!selectedBankId || bankAccounts.length === 0)) ||
        (bankSource === "new" &&
          (!bankName.trim() || !accountHolder.trim() || !accountNumber.trim()))));

  const cryptoDisabled =
    submitting ||
    !amount ||
    ((method === "btc" || method === "usdt") && !walletAddress.trim());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ArrowUpCircle className="w-6 h-6 text-[#00D4FF]" />
          Withdrawals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Request a withdrawal from your account
        </p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Available Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold accent-gradient">{formatCurrency(profile?.balance ?? 0)}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          variant={method === "btc" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "btc" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("btc")}
        >
          <Bitcoin className="w-5 h-5 mr-2" />
          Bitcoin (BTC)
        </Button>
        <Button
          variant={method === "usdt" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "usdt" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("usdt")}
        >
          <DollarSign className="w-5 h-5 mr-2" />
          USDT
        </Button>
        <Button
          variant={method === "bank" ? "default" : "outline"}
          className={`h-auto py-4 ${method === "bank" ? "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/40" : ""}`}
          onClick={() => setMethod("bank")}
        >
          <Building2 className="w-5 h-5 mr-2" />
          Bank Transfer
        </Button>
      </div>

      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base">Request Withdrawal</CardTitle>
          <p className="text-sm text-muted-foreground">
            {method === "bank"
              ? "Enter or choose where funds should be sent. After you submit, our support team will contact you to finalize the transfer."
              : `Withdraw via ${method === "btc" ? "Bitcoin" : "USDT"}. Funds will be released after admin approval.`}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                className="bg-background/50"
              />
            </div>

            {(method === "btc" || method === "usdt") && (
              <div className="space-y-2">
                <Label>
                  {method === "btc" ? "Bitcoin (BTC) wallet address" : "USDT wallet address (e.g. ERC-20)"}
                </Label>
                <Input
                  type="text"
                  placeholder={method === "btc" ? "bc1q... or 1..." : "0x..."}
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="bg-background/50 font-mono text-sm"
                />
              </div>
            )}

            {method === "bank" && (
              <div className="space-y-4 rounded-lg border border-border bg-background/30 p-4">
                {banksLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : bankAccounts.length > 0 ? (
                  <div className="space-y-3">
                    <Label className="text-xs text-muted-foreground">Bank destination</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant={bankSource === "saved" ? "default" : "outline"}
                        className={bankSource === "saved" ? "bg-[#00D4FF]/20 text-[#00D4FF]" : ""}
                        onClick={() => setBankSource("saved")}
                      >
                        Use saved account
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={bankSource === "new" ? "default" : "outline"}
                        className={bankSource === "new" ? "bg-[#00D4FF]/20 text-[#00D4FF]" : ""}
                        onClick={() => setBankSource("new")}
                      >
                        Enter new details
                      </Button>
                    </div>
                    {bankSource === "saved" && (
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                        <div className="flex-1 space-y-1.5">
                          <Label className="text-xs">Saved account</Label>
                          {(() => {
                            const selectedBank = bankAccounts.find((a) => a.id === selectedBankId);
                            const displayLabel = selectedBank
                              ? selectedBank.label
                                ? `${selectedBank.label} — ${selectedBank.bank_name}`
                                : `${selectedBank.bank_name} (${selectedBank.account_holder_name})`
                              : null;
                            return (
                              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                                <SelectTrigger className="bg-background/50">
                                  <SelectValue placeholder="Select account">
                                    {displayLabel}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {bankAccounts.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.label
                                        ? `${a.label} — ${a.bank_name}`
                                        : `${a.bank_name} (${a.account_holder_name})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </div>
                        {selectedBankId && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-red-400 shrink-0"
                            title="Remove saved account"
                            onClick={() => deleteBankAccount(selectedBankId)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}

                {(bankSource === "new" || bankAccounts.length === 0) && (
                  <div className="space-y-3 pt-1">
                    {bankAccounts.length > 0 && (
                      <p className="text-xs text-muted-foreground">New bank details for this request</p>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Bank name *</Label>
                        <Input
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. Chase, HSBC"
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Account holder (full name) *</Label>
                        <Input
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Account number / IBAN *</Label>
                        <Input
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          className="bg-background/50 font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Routing / Sort code (optional)</Label>
                        <Input
                          value={routingNumber}
                          onChange={(e) => setRoutingNumber(e.target.value)}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">SWIFT / BIC (optional)</Label>
                        <Input
                          value={swiftBic}
                          onChange={(e) => setSwiftBic(e.target.value)}
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Country (optional)</Label>
                        <Input
                          value={bankCountry}
                          onChange={(e) => setBankCountry(e.target.value)}
                          placeholder="e.g. United States"
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Label for saving (optional)</Label>
                        <Input
                          value={bankLabel}
                          onChange={(e) => setBankLabel(e.target.value)}
                          placeholder="e.g. Main checking"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveBankForNext}
                        onChange={(e) => setSaveBankForNext(e.target.checked)}
                        className="rounded border-border accent-[#00D4FF]"
                      />
                      <span className="text-sm text-muted-foreground">Save these details for next time</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={method === "bank" ? bankSubmitDisabled : cryptoDisabled}
              className="w-full bg-gradient-to-r from-[#00D4FF] to-[#0EA5E9] text-[#0A0B0F] font-semibold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Withdrawal Request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Your Withdrawal Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !requests?.length ? (
            <p className="text-muted-foreground text-sm">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map(
                (r: {
                  id: string;
                  amount: number;
                  method: string;
                  status: string;
                  created_at: string;
                  wallet_address?: string | null;
                  bank_details?: Record<string, string | null> | null;
                }) => (
                  <div
                    key={r.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-background/50 border border-border"
                  >
                    <div>
                      <p className="font-medium">{formatCurrency(r.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.method.toUpperCase()} • {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      {r.wallet_address && (
                        <p
                          className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-[280px]"
                          title={r.wallet_address}
                        >
                          To: {r.wallet_address}
                        </p>
                      )}
                      {r.method === "bank" && r.bank_details && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Bank: {r.bank_details.bank_name} • {r.bank_details.account_holder_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status === "pending" && (
                        <>
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span className="text-sm text-amber-400">Pending</span>
                        </>
                      )}
                      {r.status === "approved" && (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-green-400">Approved</span>
                        </>
                      )}
                      {r.status === "rejected" && (
                        <>
                          <XCircle className="w-4 h-4 text-red-400" />
                          <span className="text-sm text-red-400">Rejected</span>
                        </>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
