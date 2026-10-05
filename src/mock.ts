// Modo demo: backend simulado dentro del navegador (no necesita servidor).
import type { Alert, Asset, Api } from "./types";


const INITIAL: Alert[] = [
  { id: 1, s: "crit", t: "Cifrado masivo de archivos en curso", a: "srv-finanzas-01", ago: "hace 2 min", do: "Aísla el servidor de la red ahora.", act: "Aislar",
    log: [["14:02", "Detectado cifrado de 1.200 archivos"], ["14:00", "Proceso desconocido inicia con permisos de admin"], ["13:58", "Descarga de un adjunto sospechoso"]] },
  { id: 2, s: "crit", t: "Inicio de sesión de admin desde un país nuevo", a: "vpn-gateway", ago: "hace 9 min", do: "Bloquea la sesión y fuerza el cambio de contraseña.", act: "Bloquear sesión",
    log: [["13:55", "Sesión abierta desde un país nuevo"], ["13:54", "3 intentos fallidos previos"]] },
  { id: 3, s: "high", t: "Base de datos expuesta a internet", a: "db-clientes-02", ago: "hace 25 min", do: "Cierra el puerto 5432 en el firewall.", act: "Cerrar puerto",
    log: [["13:39", "Puerto 5432 abierto a 0.0.0.0/0"], ["13:30", "Cambio de regla de firewall"]] },
  { id: 4, s: "high", t: "Malware detectado en portátil", a: "laptop-ventas-17", ago: "hace 40 min", do: "Pon el equipo en cuarentena y lanza un análisis.", act: "Poner en cuarentena",
    log: [["13:24", "Antivirus detecta un troyano"], ["13:20", "Archivo descargado desde un USB"]] },
  { id: 5, s: "med", t: "Parche crítico sin instalar hace 14 días", a: "web-prod-03", ago: "hace 3 h", do: "Programa la actualización esta noche.", act: "Programar",
    log: [["11:00", "Recordatorio automático enviado"], ["hace 14 d", "Parche publicado"]] },
  { id: 6, s: "med", t: "Certificado caduca en 6 días", a: "api.empresa.com", ago: "hace 5 h", do: "Renueva el certificado antes del viernes.", act: "Renovar",
    log: [["09:00", "Aviso de caducidad"]] },
  { id: 7, s: "low", t: "Varios intentos de acceso fallidos", a: "intranet", ago: "hace 1 día", do: "Sin acción urgente. Revisa si se repite.", act: "Marcar revisada",
    log: [["ayer", "5 intentos fallidos desde la misma IP"]] },
];

const ASSETS: Asset[] = [
  { n: "srv-finanzas-01", k: "Servidor", r: 96, s: "crit", st: "Comprometido" },
  { n: "vpn-gateway", k: "Red", r: 91, s: "crit", st: "Sospechoso" },
  { n: "db-clientes-02", k: "Base de datos", r: 78, s: "high", st: "Expuesto" },
  { n: "laptop-ventas-17", k: "Equipo", r: 72, s: "high", st: "Infectado" },
  { n: "web-prod-03", k: "Servidor", r: 51, s: "med", st: "Desactualizado" },
  { n: "api.empresa.com", k: "Servicio", r: 44, s: "med", st: "Vigilar" },
  { n: "intranet", k: "Aplicación", r: 18, s: "low", st: "Seguro" },
  { n: "laptop-rrhh-04", k: "Equipo", r: 9, s: "low", st: "Seguro" },
];

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const NEW: Omit<Alert, "id" | "ago">[] = [
  { s: "crit", t: "Exfiltración de datos hacia IP desconocida", a: "db-clientes-02", do: "Corta la conexión saliente y revisa el tráfico.", act: "Cortar conexión", log: [["ahora", "4 GB enviados a una IP sin reputación"]] },
  { s: "high", t: "Ejecución de PowerShell sospechosa", a: "laptop-rrhh-04", do: "Aísla el equipo y revisa el proceso padre.", act: "Aislar equipo", log: [["ahora", "Comando codificado en base64"]] },
  { s: "med", t: "Usuario sin MFA accede a datos sensibles", a: "intranet", do: "Exige activar MFA en el próximo acceso.", act: "Exigir MFA", log: [["ahora", "Acceso a carpeta de nóminas sin segundo factor"]] },
  { s: "low", t: "Nuevo dispositivo registrado", a: "vpn-gateway", do: "Sin acción urgente. Confirma con el usuario.", act: "Marcar revisada", log: [["ahora", "Dispositivo no reconocido, mismo usuario"]] },
];

let nextId = 100;

export const mockApi: Api = {
  needsLogin: false,
  hasSession: () => true,
  logout() {},
  async login() {},
  async getRisk() { return null; },
  async getAlerts(): Promise<Alert[]> { await wait(600); return structuredClone(INITIAL); },
  async getAssets(): Promise<Asset[]> { await wait(400); return structuredClone(ASSETS); },
  async resolveAlert(_id: number): Promise<void> {
    await wait(400);
    if (Math.random() < 0.15) throw new Error("El servidor no respondió");
  },
  // Simula un WebSocket: llega una alerta nueva cada pocos segundos.
  subscribe(cb: (a: Alert) => void): () => void {
    const timer = setInterval(() => {
      const t = NEW[Math.floor(Math.random() * NEW.length)];
      cb({ ...t, id: nextId++, ago: "ahora" });
    }, 30000);
    return () => clearInterval(timer);
  },
};
