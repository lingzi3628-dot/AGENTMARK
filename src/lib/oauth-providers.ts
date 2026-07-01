// OAuth provider definitions for one-click connectors.
// Each provider has: clientId env var, auth URL, token URL, scopes, etc.
// Users set the CLIENT_ID/CLIENT_SECRET env vars to enable each provider.

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string; // lucide icon name or emoji
  color: string; // tailwind color class
  description: string;
  // Env var names that hold the client ID + secret
  clientIdEnv: string;
  clientSecretEnv: string;
  // OAuth endpoints
  authUrl: string;
  tokenUrl: string;
  // Default scopes to request
  scopes: string[];
  // User info endpoint — used after token exchange to get email/name
  userInfoUrl: string;
  // Optional: if the provider uses a different header for token exchange
  tokenAuthHeader?: "basic" | "bearer" | "body";
}

export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: "google",
    name: "Google",
    icon: "🔍",
    color: "bg-blue-500/15 text-blue-500",
    description: "Gmail, Google Drive, Google Calendar, YouTube",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/calendar"],
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  {
    id: "github",
    name: "GitHub",
    icon: "🐙",
    color: "bg-purple-500/15 text-purple-500",
    description: "Repos, issues, PRs, actions, webhooks",
    clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
    clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: ["repo", "user:email", "read:org"],
    userInfoUrl: "https://api.github.com/user",
  },
  {
    id: "slack",
    name: "Slack",
    icon: "💬",
    color: "bg-emerald-500/15 text-emerald-500",
    description: "Send messages, read channels, manage workspace",
    clientIdEnv: "SLACK_OAUTH_CLIENT_ID",
    clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write", "channels:read", "users:read", "team:read"],
    userInfoUrl: "https://slack.com/api/users.identity",
  },
  {
    id: "notion",
    name: "Notion",
    icon: "📝",
    color: "bg-gray-500/15 text-gray-500",
    description: "Read + write Notion pages and databases",
    clientIdEnv: "NOTION_OAUTH_CLIENT_ID",
    clientSecretEnv: "NOTION_OAUTH_CLIENT_SECRET",
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    userInfoUrl: "https://api.notion.com/v1/users/me",
    tokenAuthHeader: "basic",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    icon: "🪟",
    color: "bg-cyan-500/15 text-cyan-500",
    description: "Outlook, OneDrive, Teams, SharePoint",
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["https://graph.microsoft.com/Mail.Send", "https://graph.microsoft.com/Files.Read", "https://graph.microsoft.com/User.Read"],
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
  },
  {
    id: "discord",
    name: "Discord",
    icon: "🎮",
    color: "bg-indigo-500/15 text-indigo-500",
    description: "Send messages, manage servers, read channels",
    clientIdEnv: "DISCORD_OAUTH_CLIENT_ID",
    clientSecretEnv: "DISCORD_OAUTH_CLIENT_SECRET",
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    scopes: ["identify", "email", "bot"],
    userInfoUrl: "https://discord.com/api/users/@me",
  },
];

export function getOAuthProvider(id: string): OAuthProvider | undefined {
  return OAUTH_PROVIDERS.find((p) => p.id === id);
}

export function isOAuthProviderConfigured(provider: OAuthProvider): boolean {
  return !!process.env[provider.clientIdEnv] && !!process.env[provider.clientSecretEnv];
}

/** Build the OAuth authorize URL to redirect the user to. */
export function buildAuthUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv] || "",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (provider.scopes.length > 0) {
    params.set("scope", provider.scopes.join(" "));
  }
  return `${provider.authUrl}?${params.toString()}`;
}

/** Exchange the authorization code for an access token. */
export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}> {
  const body: Record<string, string> = {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };

  // Some providers (Notion) use Basic auth with client_id:client_secret
  if (provider.tokenAuthHeader === "basic") {
    const credentials = Buffer.from(
      `${process.env[provider.clientIdEnv]}:${process.env[provider.clientSecretEnv]}`,
    ).toString("base64");
    headers.authorization = `Basic ${credentials}`;
  } else {
    body.client_id = process.env[provider.clientIdEnv] || "";
    body.client_secret = process.env[provider.clientSecretEnv] || "";
  }

  const res = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });

  const data = await res.json().catch(() => ({}));
  return data;
}

/** Fetch user info from the provider after getting the access token. */
export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string,
): Promise<{
  id?: string;
  email?: string;
  name?: string;
  avatar?: string;
}> {
  try {
    const res = await fetch(provider.userInfoUrl, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    const data = await res.json();

    // Normalize across providers
    return {
      id: String(data.id || data.sub || data.user_id || ""),
      email: data.email || "",
      name: data.name || data.login || data.real_name || data.username || "",
      avatar: data.avatar_url || data.picture || data.image_url || "",
    };
  } catch {
    return {};
  }
}
