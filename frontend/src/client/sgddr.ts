// Capa de cliente para los endpoints SGDDR (clientes, casos DDR, dashboard,
// auditoría). Envoltorio fino sobre fetch que reutiliza la misma base URL y el
// token que el cliente generado por openapi-ts.
//
// Los tipos siguen el contrato del documento consolidado (lo que entregan los
// devs de backend). Cuando se ejecute `npm run generate-client` contra el
// backend ya publicado, esto se sustituye por el cliente tipado generado.

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

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("access_token")
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const body = await res.json()
      detail = body?.detail ?? detail
    } catch {
      /* sin cuerpo JSON */
    }
    throw new SgddrApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(options.headers ?? {}),
    },
  })
  return handle<T>(res)
}

// Subida multipart (no fijar Content-Type: el navegador pone el boundary).
async function fetchForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  })
  return handle<T>(res)
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

// ── Tipos del contrato ─────────────────────────────────────────────────────────
export interface Paginated<T> {
  data: T[]
  count: number
}

export interface Cliente {
  id: string
  tipo_identificacion: string
  numero_identificacion: string
  nombres: string
  apellidos: string
  fecha_nacimiento: string
  nacionalidad: string
  pais_residencia: string
  correo?: string | null
  telefono?: string | null
  ocupacion?: string | null
  fuente_ingresos?: string | null
  ingresos_mensuales_usd?: string | null
  proposito_relacion?: string | null
  es_pep: boolean
  nivel_riesgo?: string | null
  puntaje_riesgo: number
  estado: string
  ddr_requerida: boolean
  creado_en: string
}

export interface Documento {
  id: string
  nombre_archivo: string
  tipo_documento: string
  tamano_bytes: number
  hash_sha256?: string | null
  subido_en: string
}

export interface ClienteDetalle extends Cliente {
  documentos?: Documento[]
}

export interface CasoDDR {
  id: string
  cliente_id: string
  estado: string
  nivel_riesgo: string
  analista_id?: string | null
  fecha_apertura: string
  fecha_cierre?: string | null
  observaciones_rechazo?: string | null
  cliente?: Cliente
}

export interface CuestionarioEBR {
  id: string
  caso_ddr_id: string
  origen_fondos?: string | null
  proposito_relacion?: string | null
  patrimonio_estimado?: string | null
  pais_origen_patrimonio?: string | null
  tiene_estructura_societaria?: boolean | null
  familiar_pep?: boolean | null
  completado: boolean
}

export interface CasoDDRDetalle extends CasoDDR {
  cuestionario?: CuestionarioEBR | null
  documentos?: Documento[]
}

export interface CuestionarioInput {
  origen_fondos: string
  proposito_relacion: string
  patrimonio_estimado: string
  pais_origen_patrimonio: string
  tiene_estructura_societaria: boolean
  familiar_pep: boolean
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardData {
  clientes_registrados_hoy?: number
  clientes_pendientes_revision?: number
  casos_ddr_abiertos?: number
  casos_ddr_en_revision?: number
  mis_casos_abiertos?: number
  mis_casos_en_revision?: number
  casos_sin_asignar?: number
  casos_pendientes_aprobacion_alto?: number
  casos_pendientes_aprobacion_muy_alto?: number
  dias_promedio_espera?: number
  total_usuarios?: number
  usuarios_activos?: number
  total_clientes?: number
  total_casos_ddr?: number
}

export const DashboardService = {
  get: () => fetchJson<DashboardData>("/dashboard/"),
}

// ── Clientes ─────────────────────────────────────────────────────────────────
export interface ClientesQuery {
  nombre?: string
  nivel_riesgo?: string
  estado?: string
  page?: number
  size?: number
}

export const ClientesService = {
  list: (q: ClientesQuery = {}) =>
    fetchJson<Paginated<Cliente>>(
      `/clientes${qs({ ...q })}`,
    ),
  get: (id: string) => fetchJson<ClienteDetalle>(`/clientes/${id}`),
  documentos: (id: string) =>
    fetchJson<Documento[]>(`/clientes/${id}/documentos`),
  subirDocumento: (id: string, tipo: string, file: File) => {
    const form = new FormData()
    form.append("tipo_documento", tipo)
    form.append("archivo", file)
    return fetchForm<Documento>(`/clientes/${id}/documentos`, form)
  },
}

// ── Casos DDR ──────────────────────────────────────────────────────────────────
export interface CasosQuery {
  estado?: string
  nivel_riesgo?: string
  page?: number
  size?: number
}

export const CasosDdrService = {
  list: (q: CasosQuery = {}) =>
    fetchJson<Paginated<CasoDDR>>(`/casos-ddr${qs({ ...q })}`),
  get: (id: string) => fetchJson<CasoDDRDetalle>(`/casos-ddr/${id}`),
  asignar: (id: string, analista_id: string) =>
    fetchJson<CasoDDR>(`/casos-ddr/${id}/asignar`, {
      method: "PATCH",
      body: JSON.stringify({ analista_id }),
    }),
  cuestionario: (id: string) =>
    fetchJson<CuestionarioEBR>(`/casos-ddr/${id}/cuestionario`),
  guardarCuestionario: (id: string, body: CuestionarioInput) =>
    fetchJson<CuestionarioEBR>(`/casos-ddr/${id}/cuestionario`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  subirDocumento: (id: string, tipo: string, file: File) => {
    const form = new FormData()
    form.append("tipo_documento", tipo)
    form.append("archivo", file)
    return fetchForm<Documento>(`/casos-ddr/${id}/documentos`, form)
  },
  enviarAprobacion: (id: string) =>
    fetchJson<CasoDDR>(`/casos-ddr/${id}/enviar-aprobacion`, { method: "POST" }),
  aprobar: (id: string) =>
    fetchJson<CasoDDR>(`/casos-ddr/${id}/aprobar`, { method: "POST" }),
  rechazar: (id: string, observaciones: string) =>
    fetchJson<CasoDDR>(`/casos-ddr/${id}/rechazar`, {
      method: "POST",
      body: JSON.stringify({ observaciones }),
    }),
}
