"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  MessagesSquare,
  Sparkles,
  Wand2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Plus,
  Send,
  Loader2,
  Mail,
  Smartphone,
  Share2,
  MessageCircle,
  Bell,
  Inbox,
} from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CustomerConversation } from "@/lib/types";

// ---- Static option lists -----------------------------------------------------

const BUSINESS_PRESETS = [
  "Coffee shop",
  "Restaurant",
  "Salon",
  "Fitness coach / gym",
  "Real estate agency",
  "Dentist",
  "E-commerce store",
  "SaaS startup",
  "Marketing agency",
  "Online course creator",
  "Travel agency",
  "Auto repair",
  "Photography studio",
  "Law firm",
  "Accounting firm",
  "Other (type your own)",
] as const;

const AUDIENCE_PRESETS = [
  "Existing customers",
  "Cold leads",
  "Past customers",
  "Newsletter subscribers",
  "Social media followers",
  "New prospects",
  "VIP / loyalty members",
  "Referrals",
] as const;

const TONE_PRESETS = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "persuasive", label: "Persuasive" },
  { value: "urgent", label: "Urgent" },
  { value: "warm", label: "Warm" },
] as const;

const LANGUAGE_PRESETS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
] as const;

const CHANNEL_PRESETS = [
  { value: "sms", label: "SMS", icon: Smartphone, hint: "Under 160 chars" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, hint: "Short & casual" },
  { value: "email", label: "Email", icon: Mail, hint: "Subject + body" },
  { value: "social", label: "Social post", icon: Share2, hint: "Caption + hashtags" },
  { value: "push", label: "Push notification", icon: Bell, hint: "Title + body" },
] as const;

// ---- Domain types ------------------------------------------------------------

interface Topic {
  title: string;
  description: string;
}

interface CustomerMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

interface ActiveConversation extends CustomerConversation {
  messages: CustomerMessage[];
}

interface ConversationListItem extends CustomerConversation {
  messageCount: number;
}

interface DraftState {
  topic: Topic;
  channel: string;
  draft: string;
  loading: boolean;
  open: boolean;
}

// Pick a sensible default channel based on the audience.
function defaultChannelForAudience(audience: string): string {
  const a = audience.toLowerCase();
  if (a.includes("cold")) return "sms";
  if (a.includes("newsletter")) return "email";
  if (a.includes("social")) return "social";
  if (a.includes("past")) return "whatsapp";
  return "email";
}

// ---- Main view ---------------------------------------------------------------

export function CustomerView() {
  const { user } = useAuth();
  const uid = user?.firebaseUid ?? "";

  // form state
  const [business, setBusiness] = useState<string>(BUSINESS_PRESETS[0]);
  const [customBusiness, setCustomBusiness] = useState<string>("");
  const [audience, setAudience] = useState<string>(AUDIENCE_PRESETS[0]);
  const [tone, setTone] = useState<string>("friendly");
  const [language, setLanguage] = useState<string>("en");

  // list + active conversation
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [active, setActive] = useState<ActiveConversation | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // topics + draft dialog
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveBusiness = business === "Other (type your own)" ? customBusiness.trim() : business;

  // ---- data fetching ----

  const refreshList = useCallback(async () => {
    if (!uid) return;
    setListLoading(true);
    try {
      const res = await fetch(`/api/customer/conversations?uid=${encodeURIComponent(uid)}`, { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as ConversationListItem[];
        setConversations(data);
      }
    } catch {
      // ignore — list will just stay empty
    } finally {
      setListLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) void refreshList();
  }, [uid, refreshList]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (!uid) return;
      setActiveLoading(true);
      try {
        const res = await fetch(`/api/customer/conversations/${id}?uid=${encodeURIComponent(uid)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          toast.error("Could not load conversation");
          return;
        }
        const data = (await res.json()) as ActiveConversation;
        setActive(data);
        // Restore the most recent topics list from history so the user can resume.
        const lastTopicsMsg = [...data.messages]
          .reverse()
          .find((m) => m.role === "assistant" && m.meta?.kind === "topics");
        const topicsFromMeta = (lastTopicsMsg?.meta?.topics as Topic[] | undefined) ?? [];
        setTopics(topicsFromMeta);
        setDraft(null);
      } catch {
        toast.error("Could not load conversation");
      } finally {
        setActiveLoading(false);
      }
    },
    [uid],
  );

  // ---- handlers ----

  async function handleStartConversation() {
    if (!uid) return;
    if (!effectiveBusiness) {
      toast.error("Pick or type a business vertical first");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/customer/conversations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uid,
          business: effectiveBusiness,
          audience,
          tone,
          language,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const created = (await res.json()) as CustomerConversation;
      await refreshList();
      await loadConversation(created.id);
      toast.success("New conversation started", {
        description: `${effectiveBusiness} · ${audience}`,
      });
    } catch {
      toast.error("Could not start conversation");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!uid) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/customer/conversations/${id}?uid=${encodeURIComponent(uid)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      if (active?.id === id) {
        setActive(null);
        setTopics([]);
        setDraft(null);
      }
      await refreshList();
      toast.success("Conversation deleted");
    } catch {
      toast.error("Could not delete conversation");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleGenerateTopics() {
    if (!active || !effectiveBusiness) return;
    setTopicsLoading(true);
    try {
      const res = await fetch("/api/customer/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uid,
          conversationId: active.id,
          business: effectiveBusiness,
          audience: active.audience,
          tone: active.tone,
          language: active.language,
        }),
      });
      if (!res.ok) throw new Error("topics failed");
      const data = (await res.json()) as { topics: Topic[] };
      if (!data.topics?.length) {
        toast.error("No topics returned. Try a different setup.");
        return;
      }
      setTopics(data.topics);
      await refreshList();
      toast.success(`Generated ${data.topics.length} talking points`);
    } catch {
      toast.error("Could not generate topics");
    } finally {
      setTopicsLoading(false);
    }
  }

  async function handleOpenDraft(topic: Topic) {
    if (!active) return;
    const channel = defaultChannelForAudience(active.audience);
    setDraft({ topic, channel, draft: "", loading: true, open: true });
    setCopied(false);
    await fetchDraft(topic, channel);
  }

  async function handleChangeChannel(channel: string) {
    if (!draft || !active) return;
    setDraft({ ...draft, channel, draft: "", loading: true });
    setCopied(false);
    await fetchDraft(draft.topic, channel);
  }

  async function handleRegenerate() {
    if (!draft || !active) return;
    setDraft({ ...draft, draft: "", loading: true });
    setCopied(false);
    await fetchDraft(draft.topic, draft.channel);
  }

  async function fetchDraft(topic: Topic, channel: string) {
    if (!active) return;
    try {
      const res = await fetch("/api/customer/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          uid,
          conversationId: active.id,
          business: active.business,
          audience: active.audience,
          tone: active.tone,
          language: active.language,
          topic,
          channel,
        }),
      });
      if (!res.ok) throw new Error("draft failed");
      const data = (await res.json()) as { draft: string };
      setDraft((prev) =>
        prev ? { ...prev, draft: data.draft, loading: false } : prev,
      );
      await refreshList();
    } catch {
      toast.error("Could not draft message");
      setDraft((prev) => (prev ? { ...prev, loading: false } : prev));
    }
  }

  async function handleCopy() {
    if (!draft?.draft) return;
    try {
      await navigator.clipboard.writeText(draft.draft);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  }

  // Past drafts pulled from saved assistant messages — shown beneath topics.
  const pastDrafts = useMemo(() => {
    if (!active) return [];
    return active.messages
      .filter((m) => m.role === "assistant" && m.meta?.kind === "draft")
      .map((m) => ({
        id: m.id,
        content: m.content,
        channel: (m.meta?.channel as string) ?? "email",
        topic: (m.meta?.topic as Topic | undefined)?.title ?? "",
        createdAt: m.createdAt,
      }))
      .reverse();
  }, [active]);

  // ---- render ----

  return (
    <div className="flex-1 overflow-hidden">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 p-4 lg:flex-row lg:p-6">
        {/* LEFT COLUMN — setup + saved conversations */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:max-w-md lg:overflow-y-auto studio-scroll lg:pr-2">
          <Card className="p-5">
            <header className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <MessagesSquare className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Customer Mode</h2>
                <p className="text-[11px] text-muted-foreground">
                  Generate talking points & message drafts for your customers.
                </p>
              </div>
            </header>

            <div className="space-y-3.5">
              {/* Business */}
              <div>
                <Label htmlFor="cust-business" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Business vertical
                </Label>
                <Select value={business} onValueChange={setBusiness}>
                  <SelectTrigger id="cust-business" className="w-full">
                    <SelectValue placeholder="Pick a business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_PRESETS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {business === "Other (type your own)" && (
                  <Input
                    className="mt-2"
                    placeholder="e.g. Yoga studio, Bakery, Landscaping…"
                    value={customBusiness}
                    onChange={(e) => setCustomBusiness(e.target.value)}
                  />
                )}
              </div>

              {/* Audience */}
              <div>
                <Label htmlFor="cust-audience" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Audience
                </Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger id="cust-audience" className="w-full">
                    <SelectValue placeholder="Who are you talking to?" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_PRESETS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tone + Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cust-tone" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Tone
                  </Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger id="cust-tone" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_PRESETS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cust-lang" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="cust-lang" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_PRESETS.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleStartConversation}
                disabled={creating || !effectiveBusiness}
                className="w-full gap-1.5"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Start new conversation
              </Button>
            </div>
          </Card>

          {/* Saved conversations */}
          <Card className="p-5">
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Saved conversations</h3>
              <Badge variant="secondary" className="text-[10px]">
                {conversations.length}
              </Badge>
            </header>

            {listLoading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : conversations.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No conversations yet. Start one above.
              </p>
            ) : (
              <div className="max-h-96 space-y-1.5 overflow-y-auto studio-scroll pr-1">
                {conversations.map((c) => {
                  const isActive = active?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg border p-2.5 transition-all cursor-pointer",
                        isActive
                          ? "border-primary/60 bg-primary/8"
                          : "border-border hover:border-primary/40 hover:bg-accent",
                      )}
                      onClick={() => loadConversation(c.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void loadConversation(c.id);
                        }
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary">
                        <MessagesSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{c.business || "Untitled"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.audience} · {c.tone} · {c.messageCount} msgs
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeleteConversation(c.id);
                        }}
                        disabled={deletingId === c.id}
                        aria-label="Delete conversation"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>

        {/* RIGHT COLUMN — conversation workspace */}
        <section className="flex min-h-0 flex-1 flex-col">
          {!active ? (
            <EmptyState />
          ) : activeLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ActiveConversationPanel
              active={active}
              topics={topics}
              topicsLoading={topicsLoading}
              pastDrafts={pastDrafts}
              onGenerate={handleGenerateTopics}
              onDraft={handleOpenDraft}
            />
          )}
        </section>
      </div>

      {/* Draft dialog */}
      <Dialog
        open={!!draft?.open}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-primary" />
              Draft message
            </DialogTitle>
            <DialogDescription>
              {draft ? `Topic: ${draft.topic.title}` : "Compose a draft for your customer."}
            </DialogDescription>
          </DialogHeader>

          {/* Topic context */}
          {draft?.topic.description && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">About:</span>{" "}
              {draft.topic.description}
            </div>
          )}

          {/* Channel switcher */}
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_PRESETS.map((c) => {
              const Icon = c.icon;
              const isActive = draft?.channel === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleChangeChannel(c.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                    isActive
                      ? "border-primary bg-primary/12 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                  disabled={!draft || draft.loading}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Draft output */}
          <div className="relative">
            <Textarea
              value={draft?.draft ?? ""}
              readOnly
              placeholder={draft?.loading ? "Drafting your message…" : ""}
              className="min-h-[180px] resize-y bg-muted/30 font-mono text-[13px] leading-relaxed"
            />
            {draft?.loading && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" /> Generating…
              </div>
            )}
          </div>

          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 sm:justify-between">
            <div className="text-[11px] text-muted-foreground">
              {draft && (
                <span className="inline-flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {CHANNEL_PRESETS.find((c) => c.value === draft.channel)?.label ?? draft.channel}
                  </Badge>
                  {CHANNEL_PRESETS.find((c) => c.value === draft.channel)?.hint}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleRegenerate}
                disabled={!draft || draft.loading}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleCopy}
                disabled={!draft || draft.loading || !draft.draft}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Sub-components ----------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Pick a business and start generating talking points</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose your business vertical, audience, and tone on the left — then let AI suggest
          what to say and draft ready-to-send messages for SMS, email, social, and more.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px]">
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> 5-7 talking points
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Wand2 className="h-3 w-3" /> Multi-channel drafts
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <MessagesSquare className="h-3 w-3" /> Saved conversations
          </Badge>
        </div>
      </Card>
    </div>
  );
}

function ActiveConversationPanel({
  active,
  topics,
  topicsLoading,
  pastDrafts,
  onGenerate,
  onDraft,
}: {
  active: ActiveConversation;
  topics: Topic[];
  topicsLoading: boolean;
  pastDrafts: { id: string; content: string; channel: string; topic: string; createdAt: string }[];
  onGenerate: () => void;
  onDraft: (t: Topic) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto studio-scroll pr-1">
      {/* Conversation header */}
      <Card className="p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold">{active.business || "Untitled business"}</h2>
              <Badge variant="default" className="gap-1 text-[10px] capitalize">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground animate-pulse" />
                {active.tone}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Audience: <span className="text-foreground">{active.audience}</span> · Language:{" "}
              <span className="text-foreground uppercase">{active.language}</span>
            </p>
          </div>
          <Button onClick={onGenerate} disabled={topicsLoading} className="gap-1.5">
            {topicsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {topics.length > 0 ? "Regenerate topics" : "Generate topics"}
          </Button>
        </header>
      </Card>

      {/* Topics */}
      {topics.length > 0 ? (
        <div className="space-y-2.5">
          <SectionLabel icon={Sparkles} label={`Talking points (${topics.length})`} />
          {topics.map((t, i) => (
            <TopicCard key={`${t.title}-${i}`} topic={t} index={i} onDraft={() => onDraft(t)} />
          ))}
        </div>
      ) : topicsLoading ? (
        <Card className="p-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Generating talking points…</p>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">No topics yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Click <span className="font-medium text-foreground">Generate topics</span> above and AI will
            suggest 5-7 things to talk about with {active.audience.toLowerCase()}.
          </p>
        </Card>
      )}

      {/* Past drafts */}
      {pastDrafts.length > 0 && (
        <>
          <Separator className="my-2" />
          <div className="space-y-2.5">
            <SectionLabel icon={Inbox} label={`Past drafts (${pastDrafts.length})`} />
            {pastDrafts.map((d) => (
              <PastDraftCard key={d.id} draft={d} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TopicCard({
  topic,
  index,
  onDraft,
}: {
  topic: Topic;
  index: number;
  onDraft: () => void;
}) {
  return (
    <Card className="p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-xs font-semibold text-primary">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold">{topic.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{topic.description}</p>
          <div className="mt-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onDraft}>
              <Wand2 className="h-3.5 w-3.5" />
              Draft message
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function PastDraftCard({
  draft,
}: {
  draft: { id: string; content: string; channel: string; topic: string; createdAt: string };
}) {
  const [copied, setCopied] = useState(false);
  const channelDef = CHANNEL_PRESETS.find((c) => c.value === draft.channel);

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.content);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Card className="p-4">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {channelDef ? (
            <channelDef.icon className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Send className="h-3.5 w-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate text-xs font-medium">
            {draft.topic || channelDef?.label || "Draft"}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {channelDef?.label ?? draft.channel}
          </Badge>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(draft.createdAt), { addSuffix: true })}
        </span>
      </header>
      <pre className="max-h-48 overflow-y-auto studio-scroll rounded-md border border-border bg-muted/30 p-2.5 text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words font-mono">
        {draft.content}
      </pre>
      <div className="mt-2 flex justify-end">
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
