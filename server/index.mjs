// Backend de demostración. Los datos son falsos.
// En producción, acá van los conectores al SIEM/EDR/CMDB, con sus claves en variables de entorno
// (nunca en el front). El front solo habla con estas rutas.
import http from "node:http";
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3001;
const USER = process.env.DEMO_USER || "demo";
const PASS = process.env.DEMO_PASS || "demo";
const tokens = new Set();
const ago = m => new Date(Date.now() - m * 60000).toISOString();
let nextId = 100;

const A = (id, severity, title, asset, min, action, label, tl) => ({
  id, severity, title, asset, created_at: ago(min), recommended_action: action, action_label: label, status: "open",
  timeline: tl.map(([m, event]) => ({ at: ago(m), event })),
});
const alerts = [
  A(1, "critical", "Cifrado masivo de archivos en curso", "srv-finanzas-01", 2, "Aísla el servidor de la red ahora.", "Aislar", [[0, "Detectado cifrado de 1.200 archivos"], [2, "Proceso desconocido inicia con permisos de admin"], [4, "Descarga de un adjunto sospechoso"]]),
  A(2, "critical", "Inicio de sesión de admin desde un país nuevo", "vpn-gateway", 9, "Bloquea la sesión y fuerza el cambio de contraseña.", "Bloquear sesión", [[9, "Sesión abierta desde un país nuevo"], [10, "3 intentos fallidos previos"]]),
  A(3, "high", "Base de datos expuesta a internet", "db-clientes-02", 25, "Cierra el puerto 5432 en el firewall.", "Cerrar puerto", [[25, "Puerto 5432 abierto a 0.0.0.0/0"], [34, "Cambio de regla de firewall"]]),
  A(4, "high", "Malware detectado en portátil", "laptop-ventas-17", 40, "Pon el equipo en cuarentena y lanza un análisis.", "Poner en cuarentena", [[40, "Antivirus detecta un troyano"], [44, "Archivo descargado desde un USB"]]),
  A(5, "medium", "Parche crítico sin instalar hace 14 días", "web-prod-03", 180, "Programa la actualización esta noche.", "Programar", [[180, "Recordatorio automático enviado"]]),
  A(6, "medium", "Certificado caduca en 6 días", "api.empresa.com", 300, "Renueva el certificado antes del viernes.", "Renovar", [[300, "Aviso de caducidad"]]),
  A(7, "low", "Varios intentos de acceso fallidos", "intranet", 1440, "Sin acción urgente. Revisa si se repite.", "Marcar revisada", [[1440, "5 intentos fallidos desde la misma IP"]]),
];
const assets = [
  { hostname: "srv-finanzas-01", type: "server", risk_score: 96, status: "compromised" },
  { hostname: "vpn-gateway", type: "network", risk_score: 91, status: "suspicious" },
  { hostname: "db-clientes-02", type: "database", risk_score: 78, status: "exposed" },
  { hostname: "laptop-ventas-17", type: "endpoint", risk_score: 72, status: "infected" },
  { hostname: "web-prod-03", type: "server", risk_score: 51, status: "outdated" },
  { hostname: "api.empresa.com", type: "service", risk_score: 44, status: "watch" },
  { hostname: "intranet", type: "application", risk_score: 18, status: "secure" },
  { hostname: "laptop-rrhh-04", type: "endpoint", risk_score: 9, status: "secure" },
];
const NEW = [
  ["critical", "Exfiltración de datos hacia IP desconocida", "db-clientes-02", "Corta la conexión saliente y revisa el tráfico.", "Cortar conexión", "4 GB enviados a una IP sin reputación"],
  ["high", "Ejecución de PowerShell sospechosa", "laptop-rrhh-04", "Aísla el equipo y revisa el proceso padre.", "Aislar equipo", "Comando codificado en base64"],
  ["medium", "Usuario sin MFA accede a datos sensibles", "intranet", "Exige activar MFA en el próximo acceso.", "Exigir MFA", "Acceso a nóminas sin segundo factor"],
  ["low", "Nuevo dispositivo registrado", "vpn-gateway", "Sin acción urgente. Confirma con el usuario.", "Marcar revisada", "Dispositivo no reconocido, mismo usuario"],
];

// El puntaje de riesgo lo calcula el servidor.
const W = { critical: 20, high: 10, medium: 4, low: 1 };
function riskScore() {
  const open = alerts.filter(a => a.status === "open");
  const n = s => open.filter(a => a.severity === s).length;
  const raw = open.reduce((t, a) => t + W[a.severity], 0);
  return Math.min(n("critical") ? 100 : n("high") ? 74 : 49, raw);
}

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};
const readBody = req => new Promise(ok => {
  let d = ""; req.on("data", c => (d += c));
  req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch { ok({}); } });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/api/login") {
    const b = await readBody(req);
    if (b.username === USER && b.password === PASS) {
      const t = randomBytes(24).toString("hex"); tokens.add(t);
      return send(res, 200, { token: t });
    }
    return send(res, 401, { error: "Credenciales inválidas" });
  }
  if (!tokens.has((req.headers.authorization || "").replace("Bearer ", ""))) return send(res, 401, { error: "No autorizado" });
  if (req.method === "GET" && url.pathname === "/api/alerts") return send(res, 200, alerts);
  if (req.method === "GET" && url.pathname === "/api/assets") return send(res, 200, assets);
  if (req.method === "GET" && url.pathname === "/api/risk") return send(res, 200, { score: riskScore() });
  const m = url.pathname.match(/^\/api\/alerts\/(\d+)\/resolve$/);
  if (req.method === "POST" && m) {
    const a = alerts.find(x => x.id === Number(m[1]));
    if (!a) return send(res, 404, { error: "La alerta no existe" });
    a.status = "resolved";
    broadcast({ type: "risk", score: riskScore() });
    return send(res, 204);
  }
  send(res, 404, { error: "Ruta no encontrada" });
});

const wss = new WebSocketServer({ noServer: true });
const broadcast = msg => wss.clients.forEach(c => c.readyState === 1 && c.send(JSON.stringify(msg)));
server.on("upgrade", (req, socket, head) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname !== "/ws" || !tokens.has(u.searchParams.get("token"))) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"); socket.destroy(); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit("connection", ws));
});

// Cada 30 s simula una alerta nueva (máximo 12 abiertas).
setInterval(() => {
  if (alerts.filter(a => a.status === "open").length >= 12) return;
  const [sev, title, asset, action, label, event] = NEW[Math.floor(Math.random() * NEW.length)];
  const a = A(nextId++, sev, title, asset, 0, action, label, [[0, event]]);
  alerts.unshift(a);
  broadcast({ type: "alert", data: a });
  broadcast({ type: "risk", score: riskScore() });
}, 30000);

server.listen(PORT, () => console.log(`API de demo en http://localhost:${PORT}  (usuario: ${USER} / clave: ${PASS})`));
