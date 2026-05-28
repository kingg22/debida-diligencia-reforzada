// ─────────────────────────────────────────────────────────────────────────────
// Roles
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export type UserStatus = "ACTIVE" | "INACTIVE" | "BLOCKED"

export interface MockUser {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  status: UserStatus
  twoFactor: boolean
  lastAccess: string | null
}

export const MOCK_USERS_INITIAL: MockUser[] = [
  {
    id: "1",
    firstName: "Ana",
    lastName: "García",
    email: "ana.garcia@panama.com",
    role: "OFICIAL_CUMPLIMIENTO",
    status: "ACTIVE",
    twoFactor: true,
    lastAccess: "2026-05-28T09:15:00",
  },
  {
    id: "2",
    firstName: "Luis",
    lastName: "Méndez",
    email: "luis.mendez@panama.com",
    role: "ANALISTA_DDR",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-28T08:30:00",
  },
  {
    id: "3",
    firstName: "María",
    lastName: "Pérez",
    email: "maria.perez@panama.com",
    role: "ADMIN",
    status: "BLOCKED",
    twoFactor: true,
    lastAccess: "2026-05-27T17:45:00",
  },
  {
    id: "4",
    firstName: "Carlos",
    lastName: "Rodríguez",
    email: "carlos.rodriguez@panama.com",
    role: "GERENTE_CUMPLIMIENTO",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-28T07:55:00",
  },
  {
    id: "5",
    firstName: "Jessica",
    lastName: "Liang",
    email: "jessica.liang@panama.com",
    role: "AUDITOR",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-27T15:20:00",
  },
  {
    id: "6",
    firstName: "Roberto",
    lastName: "Santos",
    email: "roberto.santos@panama.com",
    role: "ANALISTA_DDR",
    status: "INACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-10T11:00:00",
  },
  {
    id: "7",
    firstName: "Patricia",
    lastName: "Mora",
    email: "patricia.mora@panama.com",
    role: "COMITE_CUMPLIMIENTO",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-28T10:05:00",
  },
  {
    id: "8",
    firstName: "Diego",
    lastName: "Herrera",
    email: "diego.herrera@panama.com",
    role: "ANALISTA_DDR",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-28T09:45:00",
  },
  {
    id: "9",
    firstName: "Elena",
    lastName: "Vásquez",
    email: "elena.vasquez@panama.com",
    role: "OFICIAL_CUMPLIMIENTO",
    status: "ACTIVE",
    twoFactor: true,
    lastAccess: "2026-05-28T08:00:00",
  },
  {
    id: "10",
    firstName: "Marco",
    lastName: "Solís",
    email: "admin@panama.com",
    role: "ADMIN",
    status: "ACTIVE",
    twoFactor: true,
    lastAccess: "2026-05-28T10:30:00",
  },
  {
    id: "11",
    firstName: "Natalia",
    lastName: "Campos",
    email: "natalia.campos@panama.com",
    role: "GERENTE_CUMPLIMIENTO",
    status: "INACTIVE",
    twoFactor: false,
    lastAccess: "2026-04-30T14:20:00",
  },
  {
    id: "12",
    firstName: "Felipe",
    lastName: "Torres",
    email: "felipe.torres@panama.com",
    role: "AUDITOR",
    status: "ACTIVE",
    twoFactor: false,
    lastAccess: "2026-05-27T16:30:00",
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

interface DemoCredential {
  email: string
  password: string
  name: string
  role: Role
  requiresTwoFactor: boolean
}

const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    email: "admin@panama.com",
    password: "Admin1234!",
    name: "Marco Solís",
    role: "ADMIN",
    requiresTwoFactor: true,
  },
  {
    email: "oficial@panama.com",
    password: "Oficial1!",
    name: "Ana García",
    role: "OFICIAL_CUMPLIMIENTO",
    requiresTwoFactor: true,
  },
  {
    email: "analista@panama.com",
    password: "Analista1!",
    name: "Luis Méndez",
    role: "ANALISTA_DDR",
    requiresTwoFactor: false,
  },
  {
    email: "gerente@panama.com",
    password: "Gerente1!",
    name: "Carlos Rodríguez",
    role: "GERENTE_CUMPLIMIENTO",
    requiresTwoFactor: false,
  },
  {
    email: "auditor@panama.com",
    password: "Auditor1!",
    name: "Jessica Liang",
    role: "AUDITOR",
    requiresTwoFactor: false,
  },
]

export interface AuthResult {
  success: boolean
  requiresTwoFactor?: boolean
  role?: Role
  name?: string
  email?: string
}

export function authenticateMock(
  email: string,
  password: string,
): AuthResult {
  const match = DEMO_CREDENTIALS.find(
    (u) =>
      u.email === email.toLowerCase().trim() && u.password === password,
  )
  if (match) {
    return {
      success: true,
      requiresTwoFactor: match.requiresTwoFactor,
      role: match.role,
      name: match.name,
      email: match.email,
    }
  }
  return { success: false }
}

export function completeLogin(role: Role, name: string, email: string) {
  localStorage.setItem("access_token", `mock_${Date.now()}`)
  localStorage.setItem("pc_user", JSON.stringify({ role, name, email }))
  localStorage.setItem(
    "pc_session_expires",
    String(Date.now() + 8 * 60 * 60 * 1000),
  )
}

export interface PcUser {
  role: Role
  name: string
  email: string
}

export function getCurrentUser(): PcUser | null {
  try {
    const raw = localStorage.getItem("pc_user")
    return raw ? (JSON.parse(raw) as PcUser) : null
  } catch {
    return null
  }
}

export function getSessionExpiry(): Date | null {
  const raw = localStorage.getItem("pc_session_expires")
  return raw ? new Date(Number(raw)) : null
}

export function pcLogout() {
  localStorage.removeItem("access_token")
  localStorage.removeItem("pc_user")
  localStorage.removeItem("pc_session_expires")
  sessionStorage.removeItem("pre_auth")
}

// ─────────────────────────────────────────────────────────────────────────────
// Password generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateSecurePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const lower = "abcdefghijklmnopqrstuvwxyz"
  const nums = "0123456789"
  const special = "!@#$%^&*()_+-=[]{}|;:,.<>?"
  const all = upper + lower + nums + special

  const chars = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    nums[Math.floor(Math.random() * nums.length)],
    special[Math.floor(Math.random() * special.length)],
  ]
  for (let i = 4; i < 14; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)])
  }
  return chars.sort(() => Math.random() - 0.5).join("")
}
