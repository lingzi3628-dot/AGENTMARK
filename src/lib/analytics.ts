// Anonymous analytics collection for open-source instances.
// When a user self-hosts AGENTMARK, they can opt-in to send anonymous usage
// data to the project maintainers. This helps understand feature usage + bugs.
//
// All data is anonymous — no API keys, no agent content, no personal info.
// Opt-in only (disabled by default). Stored in the user's localStorage.

export interface AnalyticsEvent {
  type: "app_start" | "agent_created" | "agent_run" | "integration_connected" | "template_installed" | "error";
  // Anonymous instance ID (generated once, stored in localStorage)
  instanceId: string;
  // App version
  version: string;
  // Timestamp
  timestamp: number;
  // Optional metadata (no personal info)
  metadata?: Record<string, string | number | boolean>;
}

const INSTANCE_ID_KEY = "agentmark.instance_id";
const ANALYTICS_ENABLED_KEY = "agentmark.analytics_enabled";
const COLLECTION_ENDPOINT = "https://agentmark-analytics.spyro.tech/api/collect";
// For local development, set NEXT_PUBLIC_ANALYTICS_ENDPOINT to override

export function getInstanceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(INSTANCE_ID_KEY);
  if (!id) {
    id = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(INSTANCE_ID_KEY, id);
  }
  return id;
}

export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ANALYTICS_ENABLED_KEY) === "true";
}

export function setAnalyticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ANALYTICS_ENABLED_KEY, enabled ? "true" : "false");
}

/**
 * Track an analytics event. Only sends if the user has opted in.
 * Non-blocking — fails silently.
 */
export function track(event: Omit<AnalyticsEvent, "instanceId" | "version" | "timestamp">): void {
  if (!isAnalyticsEnabled()) return;
  if (typeof window === "undefined") return;

  const fullEvent: AnalyticsEvent = {
    ...event,
    instanceId: getInstanceId(),
    version: "1.0.0",
    timestamp: Date.now(),
  };

  // Use sendBeacon for non-blocking (works even if page is closing)
  const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || COLLECTION_ENDPOINT;
  const blob = new Blob([JSON.stringify(fullEvent)], { type: "application/json" });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, blob);
    } else {
      // Fallback to fetch
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(fullEvent),
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    // Silently fail — analytics should never break the app
  }
}

/**
 * Track app start — called once when the app loads (if analytics enabled).
 */
export function trackAppStart(): void {
  track({
    type: "app_start",
    metadata: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 100) : "unknown",
      language: typeof navigator !== "undefined" ? navigator.language : "unknown",
      screen: typeof window !== "undefined" ? `${window.screen.width}x${window.screen.height}` : "unknown",
    },
  });
}
