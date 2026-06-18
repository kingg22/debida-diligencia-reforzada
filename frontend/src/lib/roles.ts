// Constantes de rol para la UI. Los valores (`ADMIN`, `OFICIAL_CUMPLIMIENTO`,
// etc.) coinciden con el enum `UserRole` del backend en `backend/app/models.py`.
// Los labels y descripciones son solo para renderizar — no se envían al backend.

export const ROLES = {
  ADMIN: "ADMIN",
  OFICIAL_CUMPLIMIENTO: "OFICIAL_CUMPLIMIENTO",
  ANALISTA_DDR: "ANALISTA_DDR",
  GERENTE_CUMPLIMIENTO: "GERENTE_CUMPLIMIENTO",
  COMITE_CUMPLIMIENTO: "COMITE_CUMPLIMIENTO",
  AUDITOR: "AUDITOR",
} as const

export type Role = keyof typeof ROLES

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  OFICIAL_CUMPLIMIENTO: "Oficial de Cumplimiento",
  ANALISTA_DDR: "Analista DDR",
  GERENTE_CUMPLIMIENTO: "Gerente de Cumplimiento",
  COMITE_CUMPLIMIENTO: "Comité de Cumplimiento",
  AUDITOR: "Auditor",
}

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Gestión de usuarios y configuración del sistema.",
  OFICIAL_CUMPLIMIENTO:
    "Aprobación de DDR nivel Alto. Requiere autenticación de dos factores.",
  ANALISTA_DDR: "Carga de expedientes y evaluación KYC.",
  GERENTE_CUMPLIMIENTO: "Aprobación de expedientes DDR nivel Muy Alto.",
  COMITE_CUMPLIMIENTO:
    "Aprobación multi-firma de expedientes DDR nivel Muy Alto.",
  AUDITOR: "Acceso de solo lectura a bitácora y reportes.",
}

export const ROLE_REQUIRES_2FA: Record<Role, boolean> = {
  ADMIN: true,
  OFICIAL_CUMPLIMIENTO: true,
  ANALISTA_DDR: false,
  GERENTE_CUMPLIMIENTO: false,
  COMITE_CUMPLIMIENTO: false,
  AUDITOR: false,
}

export const ROLE_BADGE: Record<Role, { bg: string; color: string }> = {
  ADMIN: { bg: "#2d1b69", color: "#a78bfa" },
  OFICIAL_CUMPLIMIENTO: { bg: "#1b3a2d", color: "#4ade80" },
  ANALISTA_DDR: { bg: "#1b2e4a", color: "#60a5fa" },
  GERENTE_CUMPLIMIENTO: { bg: "#3a2a1b", color: "#f59e0b" },
  COMITE_CUMPLIMIENTO: { bg: "#3a2a1b", color: "#fbbf24" },
  AUDITOR: { bg: "#2a1b1b", color: "#f87171" },
}
