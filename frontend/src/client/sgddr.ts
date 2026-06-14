// Capa de cliente para los endpoints SGDDR (clientes, casos DDR, dashboard,
// auditoría). Es un envoltorio fino sobre fetch que reutiliza la misma base URL
// y el mismo token que el cliente generado por openapi-ts.
//
// Cuando el backend regenere el OpenAPI, esto se reemplaza por el cliente
// generado (npm run generate-client). Mientras tanto, mantiene el frontend
// trabajando contra el contrato real acordado con Dev 2/Dev 3.

const BASE = import.meta.env.VITE_API_URL ?? ""

export class SgddrApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("access_token")
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      detail = body?.detail ?? detail
    } catch {
      /* respuesta sin cuerpo JSON */
    }
    throw new SgddrApiError(res.status, detail)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ── Dashboard ────────────────────────────────────────────────────────────────
// Los campos varían según el rol; todos opcionales.
export interface DashboardData {
  // Oficial de Cumplimiento
  clientes_registrados_hoy?: number
  clientes_pendientes_revision?: number
  casos_ddr_abiertos?: number
  casos_ddr_en_revision?: number
  // Analista DDR
  mis_casos_abiertos?: number
  mis_casos_en_revision?: number
  casos_sin_asignar?: number
  // Gerente / Comité
  casos_pendientes_aprobacion_alto?: number
  casos_pendientes_aprobacion_muy_alto?: number
  dias_promedio_espera?: number
  // Admin
  total_usuarios?: number
  usuarios_activos?: number
  total_clientes?: number
  total_casos_ddr?: number
}

export const DashboardService = {
  get: () => fetchJson<DashboardData>("/dashboard/"),
}
