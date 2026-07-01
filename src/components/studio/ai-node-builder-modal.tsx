"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Wand2, Loader2, Plus, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { WorkflowNode } from "@/lib/types";

const EXAMPLES = [
  "Summarize any text into 3 bullet points",
  "Translate input to French",
  "A node that classifies sentiment as positive/negative/neutral",
  "Calculate word count and reading time of the input",
  "Extract all email addresses from the input text",
  "A Python node that computes statistics on a list of numbers",
  "Format the input as a professional email response",
  "A router that sends to different branches based on language detected",
];

export function AiNodeBuilderModal({
  open,
  onOpenChange,
  onNodeCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNodeCreated: (node: WorkflowNode) => void;
}) {
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<{
    node: WorkflowNode;
    description: string;
    kind: string;
    label: string;
  } | null>(null);

  async function generate() {
    if (!description.trim()) return;
    setGenerating(true);
    setPreview(null);
    try {
      const res = await fetch("/api/nodes/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      const data = await res.json();
      setPreview(data);
      toast.success(`AI generated a ${data.kind} node!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate node");
    } finally {
      setGenerating(false);
    }
  }

  function addNode() {
    if (!preview) return;
    onNodeCreated(preview.node);
    toast.success(`Added: ${preview.label}`);
    // Reset
    setDescription("");
    setPreview(null);
    onOpenChange(false);
  }

  function reset() {
    setDescription("");
    setPreview(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            AI Node Builder
          </DialogTitle>
          <DialogDescription>
            Describe a node idea in plain English — AI will generate the full node configuration.
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. A node that extracts key phrases from the input text and ranks them by importance"
                rows={4}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    generate();
                  }
                }}
              />
              <p className="text-[11px] text-muted-foreground">Press Cmd/Ctrl+Enter to generate</p>
            </div>

            {/* Example prompts */}
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setDescription(ex)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  {ex.slice(0, 45)}{ex.length > 45 ? "…" : ""}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={generate}
                disabled={!description.trim() || generating}
                className="flex-1 gap-1.5"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Generate Node</>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Preview card */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{preview.label}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{preview.kind}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{preview.description}</p>
                </div>
              </div>
            </div>

            {/* Node details */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Generated configuration:</h4>
              <div className="rounded-md bg-muted/40 p-3 text-xs font-mono max-h-48 overflow-y-auto studio-scroll">
                <pre>{JSON.stringify(preview.node.data, null, 2)}</pre>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Try Another
              </Button>
              <Button onClick={addNode} className="flex-1 gap-1.5">
                <Plus className="h-4 w-4" /> Add to Canvas <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
