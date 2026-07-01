"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CreditCard, Save, Loader2, Check, DollarSign, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "agentmark.user_payment";

interface PaymentSettings {
  provider: "paystack" | "stripe" | "none";
  paystackSecretKey: string;
  paystackPublicKey: string;
  stripeSecretKey: string;
  stripePublishableKey: string;
  // For marketplace sales: where does the money go?
  payoutEmail: string;
}

const DEFAULTS: PaymentSettings = {
  provider: "none",
  paystackSecretKey: "",
  paystackPublicKey: "",
  stripeSecretKey: "",
  stripePublishableKey: "",
  payoutEmail: "",
};

export function UserPaymentSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PaymentSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSettings({ ...DEFAULTS, ...JSON.parse(stored), payoutEmail: user.email });
      } else {
        setSettings({ ...DEFAULTS, payoutEmail: user.email });
      }
    } catch {
      // non-fatal
    }
  }, [user]);

  function save() {
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast.success("Payment settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isConfigured = settings.provider !== "none" && (
    (settings.provider === "paystack" && settings.paystackSecretKey) ||
    (settings.provider === "stripe" && settings.stripeSecretKey)
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Payment Provider</h3>
        {isConfigured ? (
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]">
            <Check className="h-2.5 w-2.5 mr-0.5" /> Configured
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">Not set</Badge>
        )}
      </div>

      <p className="mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Set your own payment provider to sell paid templates on the marketplace.
          Payments go directly to your account — AGENTMARK takes 0% (you keep 100%).
          Keys are stored locally in your browser.
        </span>
      </p>

      <div className="space-y-4">
        {/* Provider selector */}
        <div className="space-y-1.5">
          <Label className="text-xs">Payment provider</Label>
          <Select
            value={settings.provider}
            onValueChange={(v) => setSettings((s) => ({ ...s, provider: v as PaymentSettings["provider"] }))}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (free templates only)</SelectItem>
              <SelectItem value="paystack">Paystack (Africa-focused)</SelectItem>
              <SelectItem value="stripe">Stripe (Global)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Paystack fields */}
        {settings.provider === "paystack" && (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">
              Get your keys at dashboard.paystack.co/#/settings/keys
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Secret Key</Label>
              <Input
                type="password"
                value={settings.paystackSecretKey}
                onChange={(e) => setSettings((s) => ({ ...s, paystackSecretKey: e.target.value }))}
                placeholder="sk_live_..."
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Public Key</Label>
              <Input
                value={settings.paystackPublicKey}
                onChange={(e) => setSettings((s) => ({ ...s, paystackPublicKey: e.target.value }))}
                placeholder="pk_live_..."
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
        )}

        {/* Stripe fields */}
        {settings.provider === "stripe" && (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground">
              Get your keys at dashboard.stripe.com/apikeys
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Secret Key</Label>
              <Input
                type="password"
                value={settings.stripeSecretKey}
                onChange={(e) => setSettings((s) => ({ ...s, stripeSecretKey: e.target.value }))}
                placeholder="sk_live_..."
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Publishable Key</Label>
              <Input
                value={settings.stripePublishableKey}
                onChange={(e) => setSettings((s) => ({ ...s, stripePublishableKey: e.target.value }))}
                placeholder="pk_live_..."
                className="h-9 text-sm font-mono"
              />
            </div>
          </div>
        )}

        {/* Payout email */}
        {settings.provider !== "none" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Payout email</Label>
            <Input
              type="email"
              value={settings.payoutEmail}
              onChange={(e) => setSettings((s) => ({ ...s, payoutEmail: e.target.value }))}
              placeholder="you@example.com"
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              Receipts + payment notifications go to this email.
            </p>
          </div>
        )}

        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Payment Settings
        </Button>
      </div>
    </Card>
  );
}
