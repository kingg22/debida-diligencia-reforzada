// ─────────────────────────────────────────────────────────────────────────────
// SGDDR — Constantes de dominio (fuente única de verdad para el frontend)
// Colores de riesgo y estados según el documento consolidado del proyecto.
// ─────────────────────────────────────────────────────────────────────────────

import type { UserPublic } from "@/client"

// ── Roles ──────────────────────────────────────────────────────────────────
export type Rol =
  | "ADMIN"
  | "OFICIAL_CUMPLIMIENTO"
  | "ANALISTA_DDR"
  | "GERENTE_CUMPLIMIENTO"
  | "COMITE_CUMPLIMIENTO"
  | "AUDITOR"

// El cliente generado por openapi-ts aún no incluye `role` en UserPublic
// (falta regenerar contra el backend). El endpoint /users/me sí lo devuelve.
// Este tipo puente desaparece cuando se ejecute `npm run generate-client`.
export type AppUser = UserPublic & { role?: Rol }

export const ROL_LABELS: Record<Rol, string> = {
  ADMIN: "Administrador",
  OFICIAL_CUMPLIMIENTO: "Oficial de Cumplimiento",
  ANALISTA_DDR: "Analista DDR",
  GERENTE_CUMPLIMIENTO: "Gerente de Cumplimiento",
  COMITE_CUMPLIMIENTO: "Comité de Cumplimiento",
  AUDITOR: "Auditor",
}

// Roles que pueden registrar clientes (Oficial y Admin, según spec).
export function puedeRegistrarCliente(rol?: string | null): boolean {
  return rol === "OFICIAL_CUMPLIMIENTO" || rol === "ADMIN"
}

// Roles con acceso a la sección de casos DDR.
export function tieneAccesoDDR(rol?: string | null): boolean {
  return (
    rol === "ANALISTA_DDR" ||
    rol === "OFICIAL_CUMPLIMIENTO" ||
    rol === "GERENTE_CUMPLIMIENTO" ||
    rol === "COMITE_CUMPLIMIENTO" ||
    rol === "AUDITOR" ||
    rol === "ADMIN"
  )
}

// ── Nivel de riesgo ──────────────────────────────────────────────────────────
export type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "MUY_ALTO"

export const NIVEL_RIESGO: Record<
  NivelRiesgo,
  { label: string; color: string; bg: string }
> = {
  // Colores oficiales del documento consolidado (sección 10.2 / EMILY_FRONTEND).
  MUY_ALTO: { label: "Muy Alto", color: "#B71C1C", bg: "rgba(183,28,28,0.14)" },
  ALTO: { label: "Alto", color: "#D32F2F", bg: "rgba(211,47,47,0.14)" },
  MEDIO: { label: "Medio", color: "#F57C00", bg: "rgba(245,124,0,0.14)" },
  BAJO: { label: "Bajo", color: "#2E7D32", bg: "rgba(46,125,50,0.14)" },
}

// ── Estado del caso DDR ───────────────────────────────────────────────────────
export type EstadoCaso =
  | "ABIERTO"
  | "EN_REVISION"
  | "EN_APROBACION"
  | "APROBADO"
  | "RECHAZADO"

export const ESTADO_CASO: Record<
  EstadoCaso,
  { label: string; color: string; bg: string }
> = {
  ABIERTO: { label: "Abierto", color: "#60a5fa", bg: "rgba(96,165,250,0.14)" },
  EN_REVISION: {
    label: "En revisión",
    color: "#eab308",
    bg: "rgba(234,179,8,0.14)",
  },
  EN_APROBACION: {
    label: "En aprobación",
    color: "#F57C00",
    bg: "rgba(245,124,0,0.14)",
  },
  APROBADO: { label: "Aprobado", color: "#22c55e", bg: "rgba(34,197,94,0.14)" },
  RECHAZADO: { label: "Rechazado", color: "#e05252", bg: "rgba(224,82,82,0.14)" },
}

// ── Estado del expediente KYC ──────────────────────────────────────────────────
export type EstadoKYC =
  | "BORRADOR"
  | "PENDIENTE"
  | "EN_REVISION"
  | "APROBADO"
  | "RECHAZADO"
  | "DDR_INICIADO"

export const ESTADO_KYC: Record<
  EstadoKYC,
  { label: string; color: string; bg: string }
> = {
  BORRADOR: { label: "Borrador", color: "#8a9bb5", bg: "rgba(138,155,181,0.14)" },
  PENDIENTE: {
    label: "Pendiente",
    color: "#eab308",
    bg: "rgba(234,179,8,0.14)",
  },
  EN_REVISION: {
    label: "En revisión",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.14)",
  },
  APROBADO: { label: "Aprobado", color: "#22c55e", bg: "rgba(34,197,94,0.14)" },
  RECHAZADO: { label: "Rechazado", color: "#e05252", bg: "rgba(224,82,82,0.14)" },
  DDR_INICIADO: {
    label: "DDR iniciado",
    color: "#F57C00",
    bg: "rgba(245,124,0,0.14)",
  },
}

// ── Tipo de cliente ────────────────────────────────────────────────────────────
export type TipoCliente = "NATURAL" | "JURIDICA"

export const TIPO_CLIENTE_LABELS: Record<TipoCliente, string> = {
  NATURAL: "Persona Natural",
  JURIDICA: "Persona Jurídica",
}

// ── Helpers de formato ─────────────────────────────────────────────────────────
export function formatFecha(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-PA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function formatFechaHora(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("es-PA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Días transcurridos desde una fecha (para "días abierto" en casos DDR).
export function diasDesde(iso?: string | null): number {
  if (!iso) return 0
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}
