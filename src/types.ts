export type Sev = "crit" | "high" | "med" | "low";
export type Alert = { id: number; s: Sev; t: string; a: string; ago: string; do: string; act: string; done?: boolean; log: [string, string][] };
export type Asset = { n: string; k: string; r: number; s: Sev; st: string };

export interface Api {
  needsLogin: boolean;
  hasSession(): boolean;
  logout(): void;
  login(user: string, pass: string): Promise<void>;
  getAlerts(): Promise<Alert[]>;
  getAssets(): Promise<Asset[]>;
  getRisk(): Promise<number | null>; // null = el front calcula el puntaje
  resolveAlert(id: number): Promise<void>;
  subscribe(onAlert: (a: Alert) => void, onRisk?: (score: number) => void): () => void;
}
