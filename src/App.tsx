import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { Alert, Asset, Sev } from "./types";

const ORDER: Sev[] = ["crit", "high", "med", "low"];
const SEV: Record<Sev, { n: string; shape: JSX.Element }> = {
  crit: { n: "Crítica", shape: <path d="M12 2 22 12 12 22 2 12z" /> },
  high: { n: "Alta", shape: <path d="M12 3 22 21H2z" /> },
  med: { n: "Media", shape: <circle cx="12" cy="12" r="9" /> },
  low: { n: "Baja", shape: <rect x="4" y="4" width="16" height="16" rx="2" /> },
};

const KIND: Record<string, string> = {
  Servidor: "M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.01M7 16.5h.01",
  Red: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  "Base de datos": "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  Equipo: "M5 5h14v10H5zM2 19h20",
  Servicio: "M7 18a4 4 0 010-8 5 5 0 019.6-1A4.5 4.5 0 0117 18z",
  "Aplicación": "M3 5h18v14H3zM3 9h18",
};
const KindIcon = ({ k }: { k?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={KIND[k ?? ""] ?? KIND["Servidor"]} /></svg>
);
const WEIGHT: Record<Sev, number> = { crit: 20, high: 10, med: 4, low: 1 };
const level = (n: number): [string, Sev] => n >= 75 ? ["Crítico", "crit"] : n >= 50 ? ["Alto", "high"] : n >= 25 ? ["Moderado", "med"] : ["Bajo", "low"];

const Icon = ({ s }: { s: Sev }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="currentColor" role="img" aria-label={SEV[s].n}>{SEV[s].shape}</svg>
);

function Login({ onDone }: { onDone: () => void }) {
  const [u, setU] = useState("demo");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.login(u, p); onDone(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <main className="login">
      <form className="alert" onSubmit={go}>
        <h1>Vigía</h1>
        <p className="meta">Inicia sesión para ver el centro de seguridad.</p>
        <label>Usuario<input value={u} onChange={e => setU(e.target.value)} autoComplete="username" /></label>
        <label>Contraseña<input type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" /></label>
        {err && <div className="do" role="alert">{err}</div>}
        <button className="btn p sev-high" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}

export default function App() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(!api.needsLogin || api.hasSession());
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [filter, setFilter] = useState<Sev | null>(null);
  const [tab, setTab] = useState<"A" | "B">("A");
  const [query, setQuery] = useState("");
  const [hl, setHl] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const h = () => setAuthed(false);
    window.addEventListener("unauthorized", h);
    return () => window.removeEventListener("unauthorized", h);
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    Promise.all([api.getAlerts(), api.getAssets(), api.getRisk()])
      .then(([a, x, r]) => { setAlerts(a); setAssets(x); setServerScore(r); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
    return api.subscribe(n => setAlerts(list => (list.length >= 12 ? list : [n, ...list])), setServerScore);
  }, [authed]);

  const pending = alerts.filter(a => !a.done);
  const count = (s: Sev) => pending.filter(a => a.s === s).length;
  const urgent = count("crit") + count("high");
  // Con backend real el puntaje llega del servidor; en modo demo se calcula acá.
  const raw = pending.reduce((n, a) => n + WEIGHT[a.s], 0);
  const localScore = Math.min(count("crit") ? 100 : count("high") ? 74 : 49, raw);
  const score = serverScore ?? localScore;
  const [lvl, lvlSev] = level(score);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => { if (!loading) setHist(h => [...h.slice(-13), score]); }, [score, loading]);
  const kindOf = (n: string) => assets.find(x => x.n === n)?.k;
  const spark = hist.length > 1 ? hist.map((v, i) => `${i ? "L" : "M"}${(i * 160) / (hist.length - 1)},${34 - (v / 100) * 30}`).join("") : "";
  const q = query.trim().toLowerCase();

  const shownAlerts = useMemo(() =>
    alerts
      .filter(a => (!filter || a.s === filter) && (!q || (a.t + a.a).toLowerCase().includes(q)))
      .sort((x, y) => Number(!!x.done) - Number(!!y.done) || ORDER.indexOf(x.s) - ORDER.indexOf(y.s)),
    [alerts, filter, q]);

  const shownAssets = useMemo(() =>
    assets.filter(a => (!filter || a.s === filter) && (!q || (a.n + a.k + a.st).toLowerCase().includes(q))),
    [assets, filter, q]);

  const mark = (id: number, done: boolean) => setAlerts(list => list.map(a => (a.id === id ? { ...a, done } : a)));
  const resolve = async (id: number) => {
    mark(id, true); // optimista: se ve resuelta al instante
    try { await api.resolveAlert(id); api.getRisk().then(setServerScore).catch(() => {}); }
    catch (e) { mark(id, false); setError(`No se pudo resolver la alerta. ${(e as Error).message}. Inténtalo de nuevo.`); }
  };

  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <>
      <header className="bar-top">
        <div className="bar-in">
          <svg className="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" /></svg>
          <div className="brand">Vigía<small>Centro de seguridad</small></div>
          <div className="live"><i />En vivo</div>
          {api.needsLogin && <button className="out" onClick={() => { api.logout(); setAuthed(false); }}>Salir</button>}
        </div>
      </header>
      <main>
      <section className={`hero sev-${lvlSev}`} aria-live="polite">
        <div className="ring" role="img" aria-label={`Riesgo ${score} de 100`}>
          <svg width="96" height="96" viewBox="0 0 96 96"><circle cx="48" cy="48" r="40" fill="none" stroke="var(--line)" strokeWidth="9" /><circle cx="48" cy="48" r="40" fill="none" stroke="var(--c)" strokeWidth="9" strokeLinecap="round" strokeDasharray={251.3} strokeDashoffset={251.3 * (1 - score / 100)} style={{ transition: "stroke-dashoffset .6s" }} /></svg>
          <div className="n">{score}<small>de 100</small></div>
        </div>
        <div>
          <span className="lvl">Riesgo {lvl.toLowerCase()}</span>
          <h1>{urgent ? `${urgent} ${urgent > 1 ? "cosas necesitan" : "cosa necesita"} acción ahora` : "Todo bajo control"}</h1>
          <p>{pending.length} alertas abiertas · {assets.length} activos vigilados</p>
          {spark && <svg className="spark" width="160" height="36" viewBox="0 0 160 36" role="img" aria-label="Tendencia del riesgo"><path d={spark} fill="none" stroke="var(--c)" strokeWidth="2" strokeLinejoin="round" /></svg>}
        </div>
        <div className="top3">
          <b>Activos más expuestos</b>
          {[...assets].sort((x, y) => y.r - x.r).slice(0, 3).map(x => (
            <button key={x.n} className={`t3 sev-${x.s}`} onClick={() => { setHl(x.n); setTab("B"); }}>
              <span>{x.n}</span>
              <span className="bar"><span className="tr"><i style={{ width: `${x.r}%` }} /></span><b>{x.r}</b></span>
            </button>
          ))}
        </div>
      </section>

      <div className="chips" role="group" aria-label="Filtrar por gravedad">
        {ORDER.map(s => (
          <button key={s} className={`chip sev-${s}`} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? null : s)}>
            <b>{count(s)}</b><span>{SEV[s].n}</span>
          </button>
        ))}
      </div>

      <div className="sw">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input className="search" type="search" placeholder="Buscar alerta o activo" value={query} onChange={e => setQuery(e.target.value)} aria-label="Buscar" />
      </div>

      {error && <div className="alert sev-crit" role="alert">{error} <button className="link" onClick={() => setError(null)}>Cerrar</button></div>}
      {loading && <div className="empty">Cargando alertas…</div>}

      <div className="tabs" role="tablist">
        {(["A", "B"] as const).map(t => (
          <button key={t} className="tab" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === "A" ? "Alertas" : "Activos"}<em>{t === "A" ? pending.length : assets.length}</em>
          </button>
        ))}
      </div>

      {tab === "A" ? (
        <section>
          {shownAlerts.length === 0 && <div className="empty">No hay resultados. Cambia el filtro o la búsqueda.</div>}
          {shownAlerts.map(a => (
            <article key={a.id} className={`alert sev-${a.s} ${a.done ? "done" : ""}`}>
              <div className="row">
                <span className="badge"><Icon s={a.s} />{SEV[a.s].n}</span>
                <span className="ago">{a.ago}</span>
              </div>
              <div className="t">{a.t}</div>
              <button className="asset" onClick={() => { setHl(a.a); setTab("B"); setFilter(null); setQuery(""); }}>
                <KindIcon k={kindOf(a.a)} />{a.a}
              </button>
              <div className="do"><b>{a.done ? "Resuelta" : "Qué hacer"}</b>{a.done ? a.act : a.do}</div>
              <div className="btns">
                <button className="btn p" disabled={a.done} onClick={() => resolve(a.id)}>{a.done ? "Hecho" : a.act}</button>
                <button className="btn" aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                  {openId === a.id ? "Ocultar cronología" : "Ver cronología"}
                </button>
              </div>
              {openId === a.id && (
                <ol className="tl">
                  {a.log.map(([time, text]) => <li key={time + text}><b>{time}</b>{text}</li>)}
                </ol>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="tbl">
          <table>
            <thead><tr><th>Activo</th><th>Riesgo</th><th>Estado</th></tr></thead>
            <tbody>
              {shownAssets.map(x => (
                <tr key={x.n} className={hl === x.n ? "hl" : ""}>
                  <td><div className="who"><span className="av"><KindIcon k={x.k} /></span><div><b>{x.n}</b><small>{x.k}</small></div></div></td>
                  <td><div className={`bar sev-${x.s}`}><div className="tr"><i style={{ width: `${x.r}%` }} /></div><b>{x.r}</b></div></td>
                  <td className={`sev-${x.s}`}><span className="tag"><Icon s={x.s} />{x.st}</span></td>
                </tr>
              ))}
              {shownAssets.length === 0 && <tr><td colSpan={3} className="empty">No hay activos con este filtro.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
      </main>
    </>
  );
}
