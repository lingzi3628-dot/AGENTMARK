"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, AlertTriangle, Calendar, FileText, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotificationPrefs {
  emailOnFailure: boolean;
  emailOnApproval: boolean;
  dailySummary: boolean;
  weeklyReport: boolean;
  failureThreshold: number;
  notificationEmail: string;
}

const DEFAULT_PREFS: NotificationPrefs = {
  emailOnFailure: true,
  emailOnApproval: false,
  dailySummary: false,
  weeklyReport: true,
  failureThreshold: 3,
  notificationEmail: "",
};

export function NotificationsView() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(`/api/notifications?uid=${user.firebaseUid}`);
        if (res.ok) {
          const data = (await res.json()) as NotificationPrefs;
          setPrefs({ ...DEFAULT_PREFS, ...data, notificationEmail: data.notificationEmail || user.email });
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...prefs, uid: user.firebaseUid }),
      });
      if (!res.ok) throw new Error();
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Notifications</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Choose when AGENTMARK should email you about your agents.
              </p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : (
          <>
            {/* Email address */}
            <Card className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Notification email</h3>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email address</Label>
                <Input
                  type="email"
                  value={prefs.notificationEmail}
                  onChange={(e) => setPrefs({ ...prefs, notificationEmail: e.target.value })}
                  placeholder={user.email}
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Defaults to your account email. Override if you want alerts sent elsewhere.
                </p>
              </div>
            </Card>

            {/* Failure alerts */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Agent failures</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Get an email when an agent fails {prefs.failureThreshold}+ times in a row.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.emailOnFailure}
                  onCheckedChange={(v) => setPrefs({ ...prefs, emailOnFailure: v })}
                />
              </div>
              {prefs.emailOnFailure && (
                <>
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    <Label className="text-xs">Failure threshold</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={prefs.failureThreshold}
                      onChange={(e) => setPrefs({ ...prefs, failureThreshold: Math.max(1, Math.min(10, Number(e.target.value) || 3)) })}
                      className="h-9 w-24 text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Number of consecutive failures before sending an alert.
                    </p>
                  </div>
                </>
              )}
            </Card>

            {/* Approval alerts */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Approval requests</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Get an email when a workflow pauses for your approval.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.emailOnApproval}
                  onCheckedChange={(v) => setPrefs({ ...prefs, emailOnApproval: v })}
                />
              </div>
            </Card>

            {/* Daily summary */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Daily summary</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      A daily email with your total runs, tokens used, and cost.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.dailySummary}
                  onCheckedChange={(v) => setPrefs({ ...prefs, dailySummary: v })}
                />
              </div>
            </Card>

            {/* Weekly report */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Weekly report</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      A weekly email with trends, top agents, and recommendations.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={prefs.weeklyReport}
                  onCheckedChange={(v) => setPrefs({ ...prefs, weeklyReport: v })}
                />
              </div>
            </Card>

            {/* Save */}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Preferences
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
