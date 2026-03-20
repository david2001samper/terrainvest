"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Settings,
  User,
  Upload,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Monitor,
  Bell,
  Shield,
} from "lucide-react";
import Image from "next/image";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD"];

// ─── helpers ────────────────────────────────────────
function parseUA(ua: string): string {
  if (!ua) return "Unknown device";
  const parts: string[] = [];
  if (/Windows/i.test(ua)) parts.push("Windows");
  else if (/Macintosh|Mac OS/i.test(ua)) parts.push("Mac");
  else if (/iPhone/i.test(ua)) parts.push("iPhone");
  else if (/Android/i.test(ua)) parts.push("Android");
  else if (/Linux/i.test(ua)) parts.push("Linux");

  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) parts.push("Chrome");
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) parts.push("Safari");
  else if (/Firefox/i.test(ua)) parts.push("Firefox");
  else if (/Edg/i.test(ua)) parts.push("Edge");

  return parts.length > 0 ? parts.join(" · ") : ua.slice(0, 50);
}

// ─── component ──────────────────────────────────────
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile();

  // profile fields
  const [displayName, setDisplayName] = useState("");
  const [preferredCurrency, setPreferredCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  // notifications
  const [notifyWithdrawal, setNotifyWithdrawal] = useState(true);
  const [notifyDeposit, setNotifyDeposit] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setPreferredCurrency(profile.preferred_currency ?? "USD");
      setNotifyWithdrawal(profile.notify_withdrawal ?? true);
      setNotifyDeposit(profile.notify_deposit ?? true);
    }
  }, [profile]);

  // ─── sessions ──────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["user-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/user/sessions");
      if (!res.ok) return [];
      const d = await res.json();
      return (d.sessions ?? []) as {
        id: string;
        ip: string | null;
        user_agent: string | null;
        created_at: string;
      }[];
    },
  });

  // ─── handlers ──────
  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName || null,
          preferred_currency: preferredCurrency || "USD",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      toast.success("Avatar updated");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPwd(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setChangingPwd(false);
    }
  }

  async function handleSaveNotifications() {
    setSavingNotifs(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify_withdrawal: notifyWithdrawal,
          notify_deposit: notifyDeposit,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Notification preferences saved");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSavingNotifs(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-[#00D4FF]" />
          Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your profile, security, and preferences
        </p>
      </div>

      {/* ───────── Profile ───────── */}
      <Card className="glass-card accent-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-[#00D4FF]" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {isLoading ? (
                <Skeleton className="w-20 h-20 rounded-full" />
              ) : (
                <div className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt="Avatar"
                      width={80}
                      height={80}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">
                      {(
                        profile?.display_name ||
                        profile?.email ||
                        "U"
                      )[0].toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#00D4FF] flex items-center justify-center cursor-pointer hover:bg-[#22D3EE] transition-colors">
                <Upload className="w-4 h-4 text-[#0A0B0F]" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={uploading}
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground">
                {uploading ? "Uploading..." : "JPG, PNG or GIF. Max 2MB."}
              </p>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label>Email</Label>
            {isLoading ? (
              <Skeleton className="h-10 max-w-sm" />
            ) : (
              <Input
                value={profile?.email ?? ""}
                disabled
                className="max-w-sm bg-background/30 text-muted-foreground"
              />
            )}
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="max-w-sm"
            />
          </div>

          {/* Preferred currency */}
          <div className="space-y-2">
            <Label htmlFor="currency">Preferred currency</Label>
            <select
              id="currency"
              value={preferredCurrency}
              onChange={(e) => setPreferredCurrency(e.target.value)}
              className="flex h-10 w-full max-w-sm rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="accent-gradient"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* ───────── Change Password ───────── */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#00D4FF]" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <div className="relative max-w-sm">
              <Input
                id="newPassword"
                type={showPwd ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
              >
                {showPwd ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type={showPwd ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="max-w-sm"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPwd || !newPassword || !confirmPassword}
            variant="outline"
            className="accent-border"
          >
            {changingPwd && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* ───────── Notifications ───────── */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#00D4FF]" />
            Notifications
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Choose which updates you want to receive
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center justify-between py-2 border-b border-border cursor-pointer">
            <div>
              <p className="text-sm font-medium">Withdrawal updates</p>
              <p className="text-xs text-muted-foreground">
                Get notified when your withdrawal status changes
              </p>
            </div>
            <ToggleSwitch
              checked={notifyWithdrawal}
              onChange={setNotifyWithdrawal}
            />
          </label>
          <label className="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Deposit confirmations</p>
              <p className="text-xs text-muted-foreground">
                Get notified when a deposit is confirmed
              </p>
            </div>
            <ToggleSwitch
              checked={notifyDeposit}
              onChange={setNotifyDeposit}
            />
          </label>
          <Button
            onClick={handleSaveNotifications}
            disabled={savingNotifs}
            variant="outline"
            className="accent-border"
          >
            {savingNotifs && (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            )}
            Save Preferences
          </Button>
        </CardContent>
      </Card>

      {/* ───────── Active Sessions ───────── */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00D4FF]" />
            Recent Login Activity
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 20 logins to your account
          </p>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !sessionsData || sessionsData.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No login history available yet.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {sessionsData.map((s, idx) => {
                const date = new Date(s.created_at);
                const isFirst = idx === 0;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isFirst
                        ? "border-[#00D4FF]/30 bg-[#00D4FF]/5"
                        : "border-border bg-background/50"
                    }`}
                  >
                    <Monitor className={`w-5 h-5 shrink-0 ${isFirst ? "text-[#00D4FF]" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {parseUA(s.user_agent ?? "")}
                        </p>
                        {isFirst && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#00D4FF]/15 text-[#00D4FF]">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.ip && <span className="mr-2">IP: {s.ip}</span>}
                        {date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        at{" "}
                        {date.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] ${
        checked ? "bg-[#00D4FF]" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
