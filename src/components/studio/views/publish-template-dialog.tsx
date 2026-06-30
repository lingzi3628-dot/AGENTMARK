"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Rocket, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants";
import type { Agent } from "@/lib/types";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

interface PublishTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  firebaseUid?: string;
  onPublished?: (slug: string) => void;
}

export function PublishTemplateDialog({
  open,
  onOpenChange,
  agents,
  firebaseUid,
  onPublished,
}: PublishTemplateDialogProps) {
  const [agentId, setAgentId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("custom");
  const [tags, setTags] = useState("");
  const [priceCents, setPriceCents] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Reset form whenever the dialog opens
  useEffect(() => {
    if (open) {
      setAgentId(agents[0]?.id ?? "");
      setSlug(agents[0] ? slugify(agents[0].name) : "");
      setDescription(agents[0]?.description ?? "");
      setCategory(agents[0]?.category || "custom");
      setTags("");
      setPriceCents(0);
      setSaving(false);
    }
  }, [open, agents]);

  // When the user picks a different agent, default the slug/description
  useEffect(() => {
    if (!open) return;
    const a = agents.find((x) => x.id === agentId);
    if (!a) return;
    setSlug((prev) => (prev === "" || prev === slugify(agents[0]?.name ?? "") ? slugify(a.name) : prev));
    setDescription((prev) => (prev === "" || prev === agents[0]?.description ? a.description : prev));
    setCategory(a.category || "custom");
  }, [agentId, agents, open]);

  const canSubmit = useMemo(
    () => Boolean(agentId && slug && !saving),
    [agentId, slug, saving],
  );

  async function handlePublish() {
    if (!firebaseUid) {
      toast.error("Sign in required to publish");
      return;
    }
    if (!agentId || !slug) {
      toast.error("Pick an agent and set a slug");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/marketplace/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId,
          slug,
          description,
          category,
          tags,
          priceCents,
          firebaseUid,
        }),
      });
      const data = (await res.json()) as { slug?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to publish");
      }
      toast.success("Published to the marketplace!", {
        description: `Slug: ${data.slug}`,
      });
      onPublished?.(data.slug ?? "");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Rocket className="h-5 w-5" />
          </div>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Publish to Marketplace
          </DialogTitle>
          <DialogDescription>
            Share your agent with the AGENTMARK community. Others can install
            it with one click.
          </DialogDescription>
        </DialogHeader>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              You don&apos;t have any agents yet. Create one in the Studio
              first, then come back to publish it.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Pick an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({a.nodes.length} nodes)
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">URL slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="my-awesome-agent"
                className="h-9 text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Marketplace URL: <code className="font-mono">/marketplace/{slug || "..."}</code>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do? Who is it for?"
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-sm capitalize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Price (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={priceCents === 0 ? 0 : priceCents / 100}
                  onChange={(e) => {
                    const dollars = Number(e.target.value);
                    setPriceCents(Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0);
                  }}
                  className="h-9 text-sm"
                />
                {priceCents > 0 ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Paid templates require Stripe Connect (stored as
                    ${(priceCents / 100).toFixed(2)} for now).
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Free to install</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tags (comma-separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="research, summarization, support"
                className="h-9 text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handlePublish} disabled={!canSubmit || agents.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Rocket className="mr-1.5 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
