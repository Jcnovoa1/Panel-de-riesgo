import type { Api } from "./types";
import { mockApi } from "./mock";
import { httpApi } from "./http";

// VITE_USE_MOCK=false (npm run dev:full) usa el backend real. Por defecto, modo demo.
export const api: Api = import.meta.env.VITE_USE_MOCK === "false" ? httpApi : mockApi;
