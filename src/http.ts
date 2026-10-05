import type { Alert, Api, Asset, Sev } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "";
let token: string | null = sessionStorage.getItem("token");

// ---- Traducción del formato del backend al formato de la interfaz ----
type RawAlert = { id: number; severity: string; title: string; asset: string; created_at: string; recommended_action: string; action_label: string; status: string; timeline?: { at: string; event: string }[] };
type RawAsset = { hostname: string; type: string; risk_score: number; status: string };

const SEV: Record<string, Sev> = { critical: "crit", high: "high", medium: "med", low: "low" };
const KIND: Record<string, string> = { server: "Servidor", network: "Red", database: "Base de datos", endpoint: "Equipo", service: "Servicio", application: "Aplicación" };
const STATE: Record<string, string> = { compromised: "Comprometido", suspicious: "Sospechoso", exposed: "Expuesto", infected: "Infectado", outdated: "Desactualizado", watch: "Vigilar", secure: "Seguro" };
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
};
const toAlert = (a: RawAlert): Alert => ({
  id: a.id, s: SEV[a.severity] ?? "low", t: a.title, a: a.asset, ago: ago(a.created_at),
  do: a.recommended_action, act: a.action_label, done: a.status === "resolved",
  log: (a.timeline ?? []).map(e => [hhmm(e.at), e.event] as [string, string]),
});
const toAsset = (x: RawAsset): Asset => ({
  n: x.hostname, k: KIND[x.type] ?? x.type, r: x.risk_score,
  s: x.risk_score >= 75 ? "crit" : x.risk_score >= 60 ? "high" : x.risk_score >= 40 ? "med" : "low",
  st: STATE[x.status] ?? x.status,
});

// ---- Pedidos con token ----
async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 401) {
    token = null; sessionStorage.removeItem("token");
    window.dispatchEvent(new Event("unauthorized"));
    throw new Error("La sesión venció. Inicia sesión de nuevo");
  }
  if (!res.ok) throw new Error(`El servidor respondió con error ${res.status}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const httpApi: Api = {
  needsLogin: true,
  hasSession: () => !!token,
  logout() { token = null; sessionStorage.removeItem("token"); },
  async login(username, password) {
    const res = await fetch(BASE + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (!res.ok) throw new Error("Usuario o contraseña incorrectos");
    token = (await res.json()).token as string;
    sessionStorage.setItem("token", token);
  },
  async getAlerts() { return (await req<RawAlert[]>("/api/alerts")).map(toAlert); },
  async getAssets() { return (await req<RawAsset[]>("/api/assets")).map(toAsset); },
  async getRisk() { return (await req<{ score: number }>("/api/risk")).score; },
  async resolveAlert(id) { await req<void>(`/api/alerts/${id}/resolve`, { method: "POST" }); },

  // WebSocket con reconexión (espera 1 s, 2 s, 4 s… hasta 30 s) y cierre al salir de la pantalla.
  subscribe(onAlert, onRisk) {
    let ws: WebSocket | null = null, tries = 0, closed = false, timer: number | undefined;
    const connect = () => {
      const base = import.meta.env.VITE_WS_URL ?? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
      ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token ?? "")}`);
      ws.onopen = () => { tries = 0; };
      ws.onmessage = e => {
        const m = JSON.parse(e.data);
        if (m.type === "alert") onAlert(toAlert(m.data));
        if (m.type === "risk" && onRisk) onRisk(m.score);
      };
      ws.onclose = () => { if (!closed) timer = window.setTimeout(connect, Math.min(30000, 1000 * 2 ** tries++)); };
    };
    connect();
    return () => { closed = true; window.clearTimeout(timer); ws?.close(); };
  },
};
