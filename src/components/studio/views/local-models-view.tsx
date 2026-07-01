"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Cpu, Loader2, CheckCircle2, XCircle, Plus, Trash2, RefreshCw,
  ExternalLink, Terminal, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LocalModelProvider {
  id: string;
  name: string;
  icon: string;
  defaultBaseUrl: string;
  defaultModel: string;
  installUrl: string;
  installCmd: string;
  description: string;
}

const PROVIDERS: LocalModelProvider[] = [
  {
    id: "ollama",
    name: "Ollama",
    icon: "🦙",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    installUrl: "https://ollama.ai",
    installCmd: "ollama pull llama3.2",
    description: "Easiest setup. Runs Llama, Mistral, Qwen, Phi-3, and more. Auto-detects GPU.",
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    icon: "🖥️",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultModel: "loaded-model",
    installUrl: "https://lmstudio.ai",
    installCmd: "",
    description: "GUI app with model browser. Download models visually, then start the local server.",
  },
  {
    id: "jan",
    name: "Jan",
    icon: "🤖",
    defaultBaseUrl: "http://localhost:1337/v1",
    defaultModel: "llama3.2",
    installUrl: "https://jan.ai",
    installCmd: "",
    description: "Open-source desktop app. Cross-platform. Settings → Local API Server → Enable.",
  },
  {
    id: "llamacpp",
    name: "llama.cpp",
    icon: "🔧",
    defaultBaseUrl: "http://localhost:8080/v1",
    defaultModel: "model",
    installUrl: "https://github.com/ggerganov/llama.cpp",
    installCmd: "./server -m model.gguf --port 8080",
    description: "Maximum performance. Build from source. Supports CUDA, Metal, ROCm, Vulkan.",
  },
];

interface SavedConnection {
  id: string;
  providerId: string;
  label: string;
  baseUrl: string;
  modelName: string;
  status: "connected" | "disconnected" | "checking";
}

const STORAGE_KEY = "agentmark.local_models";

export function LocalModelsView() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<LocalModelProvider | null>(null);
  const [newConn, setNewConn] = useState({ label: "", baseUrl: "", modelName: "" });
  const [testing, setTesting] = useState<string | null>(null);

  // Load saved connections
  const load = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setConnections(JSON.parse(stored) as SavedConnection[]);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // Use lazy init to avoid set-state-in-effect
  useState(() => {
    load();
    return null;
  });

  function saveConns(conns: SavedConnection[]) {
    setConnections(conns);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
  }

  function startAdd(provider: LocalModelProvider) {
    setSelectedProvider(provider);
    setNewConn({
      label: `My ${provider.name}`,
      baseUrl: provider.defaultBaseUrl,
      modelName: provider.defaultModel,
    });
    setShowAdd(true);
  }

  function addConnection() {
    if (!selectedProvider || !newConn.label.trim() || !newConn.baseUrl.trim()) {
      toast.error("Label and Base URL are required");
      return;
    }
    const conn: SavedConnection = {
      id: `lm-${Date.now()}`,
      providerId: selectedProvider.id,
      label: newConn.label.trim(),
      baseUrl: newConn.baseUrl.trim(),
      modelName: newConn.modelName.trim() || selectedProvider.defaultModel,
      status: "disconnected",
    };
    saveConns([conn, ...connections]);
    toast.success(`${selectedProvider.name} connection added`);
    setShowAdd(false);
    setSelectedProvider(null);
    setNewConn({ label: "", baseUrl: "", modelName: "" });
  }

  function deleteConnection(id: string) {
    saveConns(connections.filter((c) => c.id !== id));
    toast.success("Connection removed");
  }

  async function testConnection(conn: SavedConnection) {
    setTesting(conn.id);
    try {
      const res = await fetch(`${conn.baseUrl}/models`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const modelCount = data.data?.length || 0;
        saveConns(connections.map((c) =>
          c.id === conn.id ? { ...c, status: "connected" } : c,
        ));
        toast.success(`Connected! ${modelCount} model${modelCount !== 1 ? "s" : ""} available`);
      } else {
        saveConns(connections.map((c) =>
          c.id === conn.id ? { ...c, status: "disconnected" } : c,
        ));
        toast.error(`Server responded with ${res.status}`);
      }
    } catch (e) {
      saveConns(connections.map((c) =>
        c.id === conn.id ? { ...c, status: "disconnected" } : c,
      ));
      toast.error(e instanceof Error ? e.message : "Connection failed — is the server running?");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto studio-scroll p-4 lg:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Local Models</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Connect to local AI models — 100% free, private, and offline.
                No API keys, no cloud costs.
              </p>
            </div>
          </div>
        </Card>

        {/* Saved connections */}
        {connections.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Your connections ({connections.length})</h3>
            {connections.map((conn) => {
              const provider = PROVIDERS.find((p) => p.id === conn.providerId);
              return (
                <Card key={conn.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-lg">
                      {provider?.icon || "🔗"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{conn.label}</span>
                        {conn.status === "connected" ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[10px]">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Not tested</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="font-mono">{conn.baseUrl}</code>
                        <span>•</span>
                        <span>{conn.modelName}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={testing === conn.id}
                        onClick={() => testConnection(conn)}
                      >
                        {testing === conn.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Zap className="h-3 w-3" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteConnection(conn.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Available providers */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Available providers</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PROVIDERS.map((provider) => (
              <Card key={provider.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
                    {provider.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{provider.name}</h4>
                      <a
                        href={provider.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{provider.description}</p>
                    {provider.installCmd && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1">
                        <Terminal className="h-3 w-3 text-muted-foreground" />
                        <code className="font-mono text-[10px]">{provider.installCmd}</code>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 gap-1 text-xs"
                      onClick={() => startAdd(provider)}
                    >
                      <Plus className="h-3 w-3" /> Add Connection
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Add connection dialog (inline) */}
        {showAdd && selectedProvider && (
          <Card className="border-primary/30 p-4 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {selectedProvider.icon} Connect to {selectedProvider.name}
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                value={newConn.label}
                onChange={(e) => setNewConn((c) => ({ ...c, label: e.target.value }))}
                className="h-9 text-sm"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input
                value={newConn.baseUrl}
                onChange={(e) => setNewConn((c) => ({ ...c, baseUrl: e.target.value }))}
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Model name</Label>
              <Input
                value={newConn.modelName}
                onChange={(e) => setNewConn((c) => ({ ...c, modelName: e.target.value }))}
                className="h-9 text-sm font-mono"
                placeholder="llama3.2"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={addConnection}>Add Connection</Button>
            </div>
          </Card>
        )}

        {/* Help */}
        <Card className="border-dashed p-4">
          <h3 className="mb-2 text-sm font-medium">How to use local models</h3>
          <ol className="space-y-1 text-xs text-muted-foreground">
            <li>1. Install a local model runner (Ollama recommended for beginners)</li>
            <li>2. Download a model (e.g. <code className="font-mono">ollama pull llama3.2</code>)</li>
            <li>3. Start the server (Ollama auto-starts; LM Studio needs manual start)</li>
            <li>4. Click "Add Connection" above and enter the base URL</li>
            <li>5. Click "Test" to verify the connection works</li>
            <li>6. In any agent's Language Model node, set Provider to "custom" and use the same base URL</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}
