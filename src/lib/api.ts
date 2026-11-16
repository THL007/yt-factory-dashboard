// Client for yt-factory-api (Cloudflare Worker → Neon + R2). Owner/admin only. The token stays in this browser.
export const DEFAULT_API = "https://yt-factory-api.thl007.workers.dev";
export const RESEARCH_URL = "https://thl007.github.io/yt-factory-research/";

export type Me = { user: { id: string; username: string; display_name: string; kind: string }; role: string; token_label: string };
export type ChannelStatus = "draft" | "active" | "paused" | "archived";
export type Channel = {
  id: string; name: string; niche: string | null; language: string | null; cadence: string | null; voice_tone: string | null;
  status: ChannelStatus; created_at: string; updated_at: string; videos: number; open_research: number; members: { id: string; display_name: string }[];
};
export type Person = { id: string; username: string; display_name: string; kind: string; roles: string[] };
export type Role = { id: string; code: string; label: string };
export type Token = {
  id: string; label: string; token_prefix: string; created_at: string; last_used_at: string | null; expires_at: string | null; revoked_at: string | null;
  user_id: string; display_name: string; username: string; role: string;
};
export type Stats = {
  stages: { stage: string; n: number }[];
  per_channel: { id: string; name: string; status: string; stage: string | null; n: number }[];
  jobs: { status: string; n: number }[];
  agent: { runs: number; succeeded: number; failed: number; cost_total: number; cost_7d: number; cost_avg: number; tools_avg: number; secs_avg: number; model: string | null };
  briefs: { briefs: number; facts: number; verified: number };
  tokens: { role: string; n: number }[];
  people: { humans: number; agents: number };
  activity: { created_at: string; action: string; entity_type: string | null; entity_id: string | null; actor: string | null }[];
  generated_at: string;
};

const KEY = "ytf-dashboard";
export function getSettings(): { api: string; token: string } {
  if (typeof localStorage === "undefined") return { api: DEFAULT_API, token: "" };
  try { return { api: DEFAULT_API, token: "", ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { api: DEFAULT_API, token: "" }; }
}
export function saveSettings(s: { api: string; token: string }) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function signOut() { localStorage.removeItem(KEY); }

export class ApiError extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function call<T>(path: string, init: RequestInit = {}, s = getSettings()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(s.api.replace(/\/$/, "") + path, {
      ...init,
      headers: { Authorization: `Bearer ${s.token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, "Can’t reach the factory API. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}
const send = <T>(method: string, p: string, b?: unknown) => call<T>(p, { method, body: b === undefined ? undefined : JSON.stringify(b) });

export const api = {
  me: (s?: { api: string; token: string }) => call<Me>("/me", {}, s),
  stats: () => call<Stats>("/admin/stats"),
  channels: () => call<Channel[]>("/admin/channels"),
  createChannel: (b: Partial<Channel>) => send<{ id: string }>("POST", "/admin/channels", b),
  updateChannel: (id: string, b: Partial<Channel>) => send<{ ok: boolean }>("PATCH", `/admin/channels/${id}`, b),
  deleteChannel: (id: string) => send<{ ok: boolean }>("DELETE", `/admin/channels/${id}`),
  setMembers: (id: string, user_ids: string[]) => send<{ ok: boolean }>("PUT", `/admin/channels/${id}/members`, { user_ids }),
  people: () => call<{ users: Person[]; roles: Role[] }>("/admin/users"),
  createPerson: (b: { username: string; display_name: string }) => send<{ id: string }>("POST", "/admin/users", b),
  renamePerson: (id: string, display_name: string) => send<{ ok: boolean }>("PATCH", `/admin/users/${id}`, { display_name }),
  deactivatePerson: (id: string) => send<{ ok: boolean }>("POST", `/admin/users/${id}/deactivate`),
  tokens: () => call<Token[]>("/admin/tokens"),
  mintToken: (b: { user_id: string; role: string; label: string; expires_days?: number }) => send<{ id: string; token: string }>("POST", "/admin/tokens", b),
  revokeToken: (id: string) => send<{ ok: boolean }>("POST", `/admin/tokens/${id}/revoke`),
};

export const isAdmin = (r?: string) => r === "owner" || r === "admin";
export const STAGES = [
  { id: "idea", label: "Idea" }, { id: "script", label: "Script" }, { id: "assets", label: "Assets" }, { id: "edit", label: "Edit" },
  { id: "qa", label: "QA" }, { id: "upload", label: "Upload queue" }, { id: "published", label: "Published" },
];
export const CHANNEL_STATUS: { id: ChannelStatus; label: string }[] = [
  { id: "draft", label: "Draft" }, { id: "active", label: "Active" }, { id: "paused", label: "Paused" }, { id: "archived", label: "Archived" },
];
export const PIPELINE_ROLES = ["research", "content", "production", "publish"];

export function parseTime(iso?: string | null) {
  return iso ? new Date(iso.replace(" ", "T").replace(/\+00$/, "Z")).getTime() : NaN;
}
export function ago(iso?: string | null) {
  const t = parseTime(iso);
  if (Number.isNaN(t)) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
export const usd = (n: number, d = 2) => `$${(n || 0).toFixed(d)}`;
