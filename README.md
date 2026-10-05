# Vigía · Panel de riesgo

React + TypeScript + Vite. Alertas, activos y estado de riesgo para una persona de seguridad.

## Dos modos
- `npm install` y `npm run dev`: modo demo, todo simulado en el navegador (`src/mock.ts`). No necesita servidor. Es el modo para publicar en Vercel o Netlify.
- `npm run dev:full`: levanta el backend de demo (`server/index.mjs`) y el front conectado a él. Usuario `demo`, clave `demo`.

## Cómo está conectado
- `src/types.ts`: contrato de la interfaz (`Api`). La pantalla solo conoce este contrato.
- `src/http.ts`: cliente real. Manda el token en cada pedido, traduce el formato del backend (`severity`, `hostname`…) al de la interfaz, y reconecta el WebSocket con espera creciente.
- `server/index.mjs`: API de ejemplo (`/api/login`, `/alerts`, `/assets`, `/risk`, `/alerts/:id/resolve` y `/ws`). El puntaje de riesgo lo calcula el servidor.

## Para producción falta
Conectores reales al SIEM/EDR (con claves en variables de entorno), HTTPS, cookies httpOnly o tokens con vencimiento, límite de intentos de login y permisos por usuario.
