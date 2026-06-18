// ─────────────────────────────────────────────────────────────────────────────
// API config — fuente única de verdad para endpoints y base URL.
// El cambio de entorno (local, staging, prod) se hace exclusivamente
// mediante la variable de entorno VITE_API_URL. Todos los servicios
// consumen este módulo: nunca se hardcodea una URL concreta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base URL del backend, leída de `VITE_API_URL`.
 * - Local:    http://localhost:8000
 * - Docker:   http://backend:8000  (red interna)
 * - Staging:  https://api.staging.example.com
 * - Prod:     https://api.example.com
 */
const RAW_BASE = import.meta.env.VITE_API_URL ?? ""

/** Quita slash final para evitar `//api/v1`. */
const BASE = RAW_BASE.replace(/\/+$/, "")

/** Versión del prefijo de la API REST. Centralizada por si se versiona. */
const API_VERSION = "/api/v1"

export const API_BASE_URL = BASE
export const API_PREFIX = API_VERSION

/**
 * Endpoints por dominio. Se exportan como funciones para poder
 * añadirles path params (`/clientes/${id}`) sin repetir prefijos.
 *
 * Si en el futuro se quiere mover a un gateway con prefijo distinto,
 * basta con cambiar `API_PREFIX` o agregar una capa de rewrite aquí.
 */
export const Endpoints = {
  // ── Auth / Users (cliente auto-generado de openapi-ts los consume
  // directamente desde su `OpenAPI.BASE`, así que no se duplican aquí).
  // ── Clientes (expedientes KYC) ─────────────────────────────────────────
  clientes: {
    list: () => `${API_VERSION}/clientes/`,
    get: (id: string) => `${API_VERSION}/clientes/${id}`,
    create: () => `${API_VERSION}/clientes/`,
    update: (id: string) => `${API_VERSION}/clientes/${id}`,
    documentos: (id: string) => `${API_VERSION}/clientes/${id}/documentos`,
    deleteDocumento: (id: string, docId: string) =>
      `${API_VERSION}/clientes/${id}/documentos/${docId}`,
    evaluarRiesgo: (id: string) =>
      `${API_VERSION}/clientes/${id}/evaluar-riesgo`,
    verificarListas: (id: string) =>
      `${API_VERSION}/clientes/${id}/verificar-listas`,
  },
  // ── Casos DDR ─────────────────────────────────────────────────────────
  casosDdr: {
    list: () => `${API_VERSION}/casos-ddr/`,
    get: (id: string) => `${API_VERSION}/casos-ddr/${id}`,
    asignar: (id: string) => `${API_VERSION}/casos-ddr/${id}/asignar`,
    enviarAprobacion: (id: string) =>
      `${API_VERSION}/casos-ddr/${id}/enviar-aprobacion`,
    aprobar: (id: string) => `${API_VERSION}/casos-ddr/${id}/aprobar`,
    rechazar: (id: string) => `${API_VERSION}/casos-ddr/${id}/rechazar`,
    cuestionario: (id: string) => `${API_VERSION}/casos-ddr/${id}/cuestionario`,
    documentos: (id: string) => `${API_VERSION}/casos-ddr/${id}/documentos`,
  },
  // ── Dashboard ──────────────────────────────────────────────────────────
  dashboard: {
    get: () => `${API_VERSION}/dashboard/`,
  },
} as const

/**
 * Devuelve un path versionado con query params serializados.
 * NO incluye `API_BASE_URL`: lo añade `fetchJson` al hacer la petición.
 * Devolver solo el path evita duplicar la base al llamar a `buildUrl`
 * y luego a `fetch`, que ya la antepone.
 */
export function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  if (!params) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

/** Header `Authorization` con el JWT en localStorage, si existe. */
export function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = window.localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}
