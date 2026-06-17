// Capa de cliente para los endpoints SGDDR (clientes, casos DDR, dashboard).
// Capa fina sobre `fetch` que reusa la misma base URL centralizada en
// `lib/api-config.ts`. La versión de la API, los paths y los query params
// están alineados con el backend FastAPI (`backend/app/api/routes/*`).
//
// Si necesitas tocar una URL, cámbiala en `lib/api-config.ts` — nunca aquí.

import {
  API_BASE_URL,
  authHeader,
  buildUrl,
  Endpoints,
} from "@/lib/api-config"

export class SgddrApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
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

async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
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
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  })
  return handle<T>(res)
}

// ── Tipos del contrato ────────────────────────────────────────────────────
export interface Paginated<T> {
  data: T[]
  count: number
}

// Forma expuesta por la API (alineada a `ExpedienteKYCPublic`).
export interface PersonaNatural {
  id: string
  tipo_documento: string
  numero_documento: string
  fecha_expiracion_doc: string
  nacionalidad: string
  pais_nacimiento: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  genero: string
  estado_civil: string
  telefono: string
  email: string
  direccion: string
  ciudad: string
  pais: string
  ocupacion: string
  empleador: string
  ingreso_mensual_aproximado: number
  fuente_ingresos: string
  es_pep: boolean
  es_pep_familiar: boolean
  tiene_antecedentes: boolean
}

export interface PersonaJuridica {
  id: string
  razon_social: string
  ruc: string
  tipo_sociedad: string
  fecha_constitucion: string
  pais_constitucion: string
  numero_registro_mercantil: string
  nombre_representante: string
  cedula_representante: string
  cargo_representante: string
  telefono_empresa: string
  email_empresa: string
  direccion_fiscal: string
  ciudad: string
  pais: string
  actividad_economica: string
  ingreso_anual_aproximado: number
  cantidad_empleados: number
  tiene_accionistas_anonimos: boolean
  opera_en_paises_alto_riesgo: boolean
}

export interface BeneficiarioFinal {
  id: string
  nombre: string
  apellido: string
  cedula: string
  nacionalidad: string
  pais: string
  fecha_nacimiento: string
  porcentaje_participacion: number
  es_pep: boolean
}

export interface Documento {
  id: string
  expediente_id: string
  caso_ddr_id?: string | null
  tipo: string
  nombre: string
  tamanio: number
  mime_type: string
  estado: string
  hash_sha256?: string | null
  fecha_carga?: string | null
}

// Expediente KYC tal como lo entrega el backend.
export interface ExpedienteKYC {
  id: string
  codigo: string
  tipo_cliente: "NATURAL" | "JURIDICA"
  status:
    | "BORRADOR"
    | "PENDIENTE"
    | "EN_REVISION"
    | "APROBADO"
    | "RECHAZADO"
    | "DDR_INICIADO"
  nivel_riesgo: "BAJO" | "MEDIO" | "ALTO" | "MUY_ALTO" | null
  puntaje_riesgo: number | null
  comentario_rechazo: string | null
  analista_id: string
  created_at: string | null
  updated_at: string | null
  persona_natural: PersonaNatural | null
  persona_juridica: PersonaJuridica | null
  beneficiarios_final: BeneficiarioFinal[]
  documentos: Documento[]
}

// ── Vista "Cliente" para las pantallas de UI ──────────────────────────────
// La UI muestra una sola tabla plana (nombre, identificación, riesgo, estado).
// Esta vista aplana el expediente KYC y se construye a partir de un
// ExpedienteKYC. Mantener un solo "shape" evita N transformaciones en cada
// componente.
export interface Cliente {
  id: string
  codigo: string
  tipo_cliente: "NATURAL" | "JURIDICA"
  nombres: string
  apellidos: string
  tipo_identificacion: string
  numero_identificacion: string
  correo: string | null
  telefono: string | null
  ocupacion: string | null
  fuente_ingresos: string | null
  ingresos_mensuales_usd: string | null
  proposito_relacion: string | null
  es_pep: boolean
  nivel_riesgo: string | null
  puntaje_riesgo: number | null
  estado: string
  ddr_requerida: boolean
  creado_en: string | null
}

export interface ClienteDetalle extends Cliente {
  fecha_nacimiento: string | null
  nacionalidad: string | null
  pais_residencia: string | null
  fecha_expiracion_doc: string | null
  documentos: Documento[]
}

/** Adapta un ExpedienteKYC (backend) a la vista plana Cliente (UI). */
export function expedienteACliente(e: ExpedienteKYC): Cliente {
  const pn = e.persona_natural
  const pj = e.persona_juridica
  const esNatural = e.tipo_cliente === "NATURAL"

  const nombres = esNatural ? pn?.nombre ?? "" : pj?.razon_social ?? ""
  const apellidos = esNatural ? pn?.apellido ?? "" : ""

  const identificacion = esNatural
    ? `${pn?.tipo_documento ?? ""} ${pn?.numero_documento ?? ""}`.trim()
    : `RUC ${pj?.ruc ?? ""}`.trim()

  return {
    id: e.id,
    codigo: e.codigo,
    tipo_cliente: e.tipo_cliente,
    nombres,
    apellidos,
    tipo_identificacion: esNatural
      ? pn?.tipo_documento ?? "CEDULA"
      : "RUC",
    numero_identificacion: identificacion,
    correo: esNatural ? pn?.email ?? null : pj?.email_empresa ?? null,
    telefono: esNatural ? pn?.telefono ?? null : pj?.telefono_empresa ?? null,
    ocupacion: esNatural ? pn?.ocupacion ?? null : pj?.actividad_economica ?? null,
    fuente_ingresos: esNatural ? pn?.fuente_ingresos ?? null : null,
    ingresos_mensuales_usd: esNatural
      ? String(pn?.ingreso_mensual_aproximado ?? "")
      : String(pj?.ingreso_anual_aproximado ?? ""),
    proposito_relacion: null,
    es_pep: esNatural ? pn?.es_pep ?? false : false,
    nivel_riesgo: e.nivel_riesgo,
    puntaje_riesgo: e.puntaje_riesgo,
    estado: e.status,
    ddr_requerida:
      e.status === "DDR_INICIADO" ||
      e.nivel_riesgo === "ALTO" ||
      e.nivel_riesgo === "MUY_ALTO",
    creado_en: e.created_at,
  }
}

export function expedienteAClienteDetalle(e: ExpedienteKYC): ClienteDetalle {
  const base = expedienteACliente(e)
  const pn = e.persona_natural
  const pj = e.persona_juridica
  const esNatural = e.tipo_cliente === "NATURAL"
  return {
    ...base,
    fecha_nacimiento: esNatural ? pn?.fecha_nacimiento ?? null : null,
    nacionalidad: esNatural ? pn?.nacionalidad ?? null : pj?.pais_constitucion ?? null,
    pais_residencia: esNatural ? pn?.pais ?? null : pj?.pais ?? null,
    fecha_expiracion_doc: esNatural ? pn?.fecha_expiracion_doc ?? null : null,
    documentos: e.documentos,
  }
}

// ── Tipos para creación de expediente (formulario KYC) ───────────────────
export interface BeneficiarioFinalInput {
  nombre: string
  apellido: string
  cedula: string
  nacionalidad: string
  pais: string
  fecha_nacimiento: string
  porcentaje_participacion: number
  es_pep: boolean
}

export interface PersonaNaturalInput {
  tipo_documento: string
  numero_documento: string
  fecha_expiracion_doc: string
  nacionalidad: string
  pais_nacimiento: string
  nombre: string
  apellido: string
  fecha_nacimiento: string
  genero: string
  estado_civil: string
  telefono: string
  email: string
  direccion: string
  ciudad: string
  pais: string
  ocupacion: string
  empleador: string
  ingreso_mensual_aproximado: number
  fuente_ingresos: string
  es_pep: boolean
  es_pep_familiar: boolean
  tiene_antecedentes: boolean
}

export interface PersonaJuridicaInput {
  razon_social: string
  ruc: string
  tipo_sociedad: string
  fecha_constitucion: string
  pais_constitucion: string
  numero_registro_mercantil: string
  nombre_representante: string
  cedula_representante: string
  cargo_representante: string
  telefono_empresa: string
  email_empresa: string
  direccion_fiscal: string
  ciudad: string
  pais: string
  actividad_economica: string
  ingreso_anual_aproximado: number
  cantidad_empleados: number
  tiene_accionistas_anonimos: boolean
  opera_en_paises_alto_riesgo: boolean
}

export interface CreateExpedienteInput {
  tipo_cliente: "NATURAL" | "JURIDICA"
  persona_natural?: PersonaNaturalInput
  persona_juridica?: PersonaJuridicaInput
  beneficiarios_final: BeneficiarioFinalInput[]
  enviar_a_revision: boolean
}

// ── Caso DDR ─────────────────────────────────────────────────────────────
export interface CasoDDR {
  id: string
  expediente_id: string
  nivel_riesgo: string
  status: "ABIERTO" | "EN_REVISION" | "EN_APROBACION" | "APROBADO" | "RECHAZADO"
  analista_id: string | null
  aprobado_por_id: string | null
  observaciones_rechazo: string | null
  fecha_apertura: string | null
  fecha_cierre: string | null
  updated_at: string | null
}

export interface CuestionarioEBR {
  id: string
  caso_ddr_id: string
  origen_fondos: string | null
  proposito_relacion: string | null
  patrimonio_estimado: string | null
  pais_origen_patrimonio: string | null
  tiene_estructura_societaria: boolean | null
  familiar_pep: boolean | null
  completado: boolean
  completado_por: string | null
  completado_en: string | null
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

export interface RechazoInput {
  observaciones: string
}

// ── Dashboard ────────────────────────────────────────────────────────────
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

// ── Dashboard ────────────────────────────────────────────────────────────
export const DashboardService = {
  get: () => fetchJson<DashboardData>(Endpoints.dashboard.get()),
}

// ── Clientes (expedientes KYC) ────────────────────────────────────────────
// El backend pagina con `skip`/`limit`; el UI trabaja con `page`/`size`.
// El wrapper traduce para que las pantallas no se acoplen a FastAPI.
export interface ClientesQuery {
  nombre?: string
  nivel_riesgo?: string
  estado?: string
  page?: number
  size?: number
}

function toSkipLimit(q: ClientesQuery): {
  skip: number
  limit: number
  search?: string
  status?: string
  riesgo?: string
} {
  const page = q.page ?? 1
  const size = q.size ?? 20
  return {
    skip: (page - 1) * size,
    limit: size,
    ...(q.nombre ? { search: q.nombre } : {}),
    ...(q.estado ? { status: q.estado } : {}),
    ...(q.nivel_riesgo ? { riesgo: q.nivel_riesgo } : {}),
  }
}

export const ClientesService = {
  list: async (q: ClientesQuery = {}) => {
    const { skip, limit, search, status, riesgo } = toSkipLimit(q)
    const path = buildUrl(Endpoints.clientes.list(), {
      skip,
      limit,
      search,
      status,
      riesgo,
    })
    const raw = await fetchJson<Paginated<ExpedienteKYC>>(path)
    return {
      data: raw.data.map(expedienteACliente),
      count: raw.count,
    }
  },
  get: async (id: string): Promise<ClienteDetalle> => {
    const raw = await fetchJson<ExpedienteKYC>(Endpoints.clientes.get(id))
    return expedienteAClienteDetalle(raw)
  },
  create: (body: CreateExpedienteInput) =>
    fetchJson<ExpedienteKYC>(Endpoints.clientes.create(), {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Record<string, unknown>) =>
    fetchJson<ExpedienteKYC>(Endpoints.clientes.update(id), {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  documentos: (id: string) =>
    fetchJson<Paginated<Documento>>(Endpoints.clientes.documentos(id)),
  subirDocumento: (id: string, tipo: string, file: File) => {
    const form = new FormData()
    form.append("tipo_documento", tipo)
    form.append("file", file)
    return fetchForm<Documento>(Endpoints.clientes.documentos(id), form)
  },
  deleteDocumento: (id: string, docId: string) =>
    fetchJson<{ message: string }>(
      Endpoints.clientes.deleteDocumento(id, docId),
      { method: "DELETE" },
    ),
}

// ── Casos DDR ────────────────────────────────────────────────────────────
export interface CasosQuery {
  estado?: string
  nivel_riesgo?: string
  page?: number
  size?: number
}

function casosToSkipLimit(q: CasosQuery): {
  skip: number
  limit: number
  status?: string
  nivel_riesgo?: string
} {
  const page = q.page ?? 1
  const size = q.size ?? 20
  return {
    skip: (page - 1) * size,
    limit: size,
    ...(q.estado ? { status: q.estado } : {}),
    ...(q.nivel_riesgo ? { nivel_riesgo: q.nivel_riesgo } : {}),
  }
}

export const CasosDdrService = {
  list: async (q: CasosQuery = {}) => {
    const { skip, limit, status, nivel_riesgo } = casosToSkipLimit(q)
    const path = buildUrl(Endpoints.casosDdr.list(), {
      skip,
      limit,
      status,
      nivel_riesgo,
    })
    return fetchJson<Paginated<CasoDDR>>(path)
  },
  get: (id: string) => fetchJson<CasoDDRDetalle>(Endpoints.casosDdr.get(id)),
  asignar: (id: string, analista_id: string) =>
    fetchJson<CasoDDR>(Endpoints.casosDdr.asignar(id), {
      method: "PATCH",
      body: JSON.stringify({ analista_id }),
    }),
  cuestionario: (id: string) =>
    fetchJson<CuestionarioEBR>(Endpoints.casosDdr.cuestionario(id)),
  guardarCuestionario: (id: string, body: CuestionarioInput) =>
    fetchJson<CuestionarioEBR>(Endpoints.casosDdr.cuestionario(id), {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  subirDocumento: (id: string, tipo: string, file: File) => {
    const form = new FormData()
    form.append("tipo_documento", tipo)
    form.append("file", file)
    return fetchForm<Documento>(Endpoints.casosDdr.documentos(id), form)
  },
  listarDocumentos: (id: string) =>
    fetchJson<Paginated<Documento>>(Endpoints.casosDdr.documentos(id)),
  enviarAprobacion: (id: string) =>
    fetchJson<CasoDDR>(Endpoints.casosDdr.enviarAprobacion(id), {
      method: "POST",
    }),
  aprobar: (id: string) =>
    fetchJson<CasoDDR>(Endpoints.casosDdr.aprobar(id), { method: "POST" }),
  rechazar: (id: string, body: RechazoInput) =>
    fetchJson<CasoDDR>(Endpoints.casosDdr.rechazar(id), {
      method: "POST",
      body: JSON.stringify(body),
    }),
}
