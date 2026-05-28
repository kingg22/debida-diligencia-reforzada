import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react"
import { createFileRoute } from "@tanstack/react-router"
import {
  Plus,
  Search,
  Pencil,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  ShieldCheck,
  Users,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight as ChevronExpand,
  X,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  MOCK_USERS_INITIAL,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_REQUIRES_2FA,
  ROLE_BADGE,
  generateSecurePassword,
  type MockUser,
  type Role,
  type UserStatus,
} from "@/lib/mock-data"
import { PasswordStrengthBar } from "@/components/auth/PasswordStrengthBar"
import { PasswordChecklist, passwordIsValid } from "@/components/auth/PasswordChecklist"

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/_layout/usuarios")({
  component: UsersPage,
  head: () => ({
    meta: [{ title: "Gestión de Usuarios — PanamaCompliance SGDDR" }],
  }),
})

// ─── Zod schemas ──────────────────────────────────────────────────────────────
const ROLE_VALUES = [
  "ADMIN",
  "OFICIAL_CUMPLIMIENTO",
  "ANALISTA_DDR",
  "GERENTE_CUMPLIMIENTO",
  "COMITE_CUMPLIMIENTO",
  "AUDITOR",
] as const

const nameRegex = /^[\p{L}\s''-]+$/u

const createSchema = z.object({
  firstName: z
    .string()
    .min(2, "Ingresa el nombre (mín. 2 caracteres)")
    .max(50)
    .regex(nameRegex, "Solo se permiten letras y espacios"),
  lastName: z
    .string()
    .min(2, "Ingresa los apellidos (mín. 2 caracteres)")
    .max(50)
    .regex(nameRegex, "Solo se permiten letras y espacios"),
  email: z.string().email("Correo electrónico no válido"),
})

const editSchema = z.object({
  firstName: z
    .string()
    .min(2, "Ingresa el nombre (mín. 2 caracteres)")
    .max(50)
    .regex(nameRegex, "Solo se permiten letras y espacios"),
  lastName: z
    .string()
    .min(2, "Ingresa los apellidos (mín. 2 caracteres)")
    .max(50)
    .regex(nameRegex, "Solo se permiten letras y espacios"),
})

type CreateData = z.infer<typeof createSchema>
type EditData = z.infer<typeof editSchema>

// ─── Tiny primitives ──────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const { bg, color } = ROLE_BADGE[role]
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {ROLE_LABELS[role]}
    </span>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const cfg =
    status === "ACTIVE"
      ? { label: "Activo", bg: "rgba(34,197,94,0.12)", color: "#22c55e" }
      : status === "BLOCKED"
        ? { label: "Bloqueado", bg: "rgba(224,82,82,0.12)", color: "#e05252" }
        : { label: "Inactivo", bg: "rgba(74,96,128,0.15)", color: "#8a9bb5" }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-[#c9a84c]" : "bg-[#1b2e4a]",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  )
}

function FieldLabel({
  children,
  required,
  htmlFor,
}: {
  children: ReactNode
  required?: boolean
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-sm"
      style={{ color: "#8a9bb5" }}
    >
      {children}
      {required && <span style={{ color: "#e05252" }}> *</span>}
    </label>
  )
}

function FieldInput({
  hasError,
  className,
  ...props
}: React.ComponentProps<"input"> & { hasError?: boolean }) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border px-3 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
        "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
        hasError
          ? "border-[#e05252] focus:border-[#e05252]"
          : "border-[#1b2e4a] focus:border-[#c9a84c]",
        className,
      )}
      style={{ backgroundColor: "#0f1f3a" }}
    />
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p role="alert" className="mt-1.5 text-xs" style={{ color: "#e05252" }}>
      {msg}
    </p>
  )
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-4 mt-1">
      <p
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#4a6080" }}
      >
        {title}
      </p>
      <div className="h-px" style={{ backgroundColor: "#1b2e4a" }} />
    </div>
  )
}

// ─── Role Select ──────────────────────────────────────────────────────────────
function RoleSelectField({
  value,
  onChange,
  errorMsg,
}: {
  value: Role | ""
  onChange: (r: Role) => void
  errorMsg?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm",
          "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
          errorMsg
            ? "border-[#e05252] focus:border-[#e05252]"
            : "border-[#1b2e4a] focus:border-[#c9a84c]",
        )}
        style={{ backgroundColor: "#0f1f3a" }}
      >
        <span style={{ color: value ? "#f0ede8" : "#4a6080" }}>
          {value ? ROLE_LABELS[value as Role] : "Selecciona un rol"}
        </span>
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
          style={{ color: "#4a6080" }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl"
          style={{
            backgroundColor: "#0f1f3a",
            border: "1px solid #1b2e4a",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}
        >
          {ROLE_VALUES.map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => {
                onChange(r)
                setOpen(false)
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-[#1b2e4a]",
                r === value && "bg-[#1b2e4a]",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "#f0ede8" }}>
                  {ROLE_LABELS[r]}
                </span>
                {ROLE_REQUIRES_2FA[r] && (
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: "rgba(201,168,76,0.15)",
                      color: "#c9a84c",
                    }}
                  >
                    2FA
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: "#4a6080" }}>
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </button>
          ))}
        </div>
      )}

      <FieldError msg={errorMsg} />
    </div>
  )
}

// ─── Password field with eye / generate / copy ────────────────────────────────
function PasswordField({
  value,
  onChange,
  withGenerate,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  withGenerate?: boolean
  hasError?: boolean
}) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className={cn(
            "h-10 w-full rounded-lg border px-3 pr-10 text-sm font-mono text-[#f0ede8] placeholder:font-sans placeholder:text-[#4a6080]",
            "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
            hasError
              ? "border-[#e05252] focus:border-[#e05252]"
              : "border-[#1b2e4a] focus:border-[#c9a84c]",
          )}
          style={{ backgroundColor: "#0f1f3a" }}
        />
        <button
          type="button"
          onClick={() => setShow((p) => !p)}
          aria-label={show ? "Ocultar" : "Mostrar"}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 transition-colors hover:text-[#c9a84c]"
          style={{ color: "#4a6080" }}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {withGenerate && (
        <button
          type="button"
          onClick={() => onChange(generateSecurePassword())}
          title="Generar contraseña segura"
          className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-[#1b2e4a]"
          style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
        >
          <Shuffle size={14} />
        </button>
      )}

      {value && (
        <button
          type="button"
          onClick={copy}
          title={copied ? "Copiado" : "Copiar contraseña"}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
            copied
              ? "border-[rgba(34,197,94,0.3)] text-[#22c55e]"
              : "border-[#1b2e4a] text-[#8a9bb5] hover:bg-[#1b2e4a]",
          )}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      )}
    </div>
  )
}

// ─── Create User Modal ────────────────────────────────────────────────────────
function CreateUserModal({
  onClose,
  existingEmails,
  onCreated,
}: {
  onClose: () => void
  existingEmails: string[]
  onCreated: (u: MockUser) => void
}) {
  const [role, setRole] = useState<Role | "">("")
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE")
  const [twoFactor, setTwoFactor] = useState(false)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [roleError, setRoleError] = useState("")
  const [pwTouched, setPwTouched] = useState(false)

  const requires2FA = role ? ROLE_REQUIRES_2FA[role as Role] : false
  useEffect(() => {
    if (requires2FA) setTwoFactor(true)
  }, [requires2FA])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateData>({ resolver: zodResolver(createSchema) })

  const submit = async (data: CreateData) => {
    if (!role) {
      setRoleError("Selecciona un rol")
      return
    }
    if (!passwordIsValid(password)) {
      setPwTouched(true)
      return
    }
    if (existingEmails.includes(data.email.toLowerCase().trim())) {
      setError("email", {
        message: "Este correo ya está registrado en el sistema",
      })
      return
    }
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 800))
    const newUser: MockUser = {
      id: String(Date.now()),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.toLowerCase().trim(),
      role: role as Role,
      status,
      twoFactor,
      lastAccess: null,
    }
    onCreated(newUser)
    toast.success(`Usuario ${newUser.firstName} ${newUser.lastName} creado exitosamente.`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,13,28,0.85)" }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "#0a1628",
          border: "1px solid #1b2e4a",
          boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid #1b2e4a" }}
        >
          <h2
            className="text-[22px]"
            style={{
              fontFamily: "DM Serif Display, serif",
              color: "#f0ede8",
              fontWeight: 400,
            }}
          >
            Nuevo Usuario
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 transition-colors hover:bg-[#1b2e4a]"
            style={{ color: "#4a6080" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Personal info */}
          <div>
            <SectionDivider title="Información personal" />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required htmlFor="c-fname">
                  Nombre(s)
                </FieldLabel>
                <FieldInput
                  id="c-fname"
                  placeholder="Nombre"
                  hasError={!!errors.firstName}
                  {...register("firstName")}
                />
                <FieldError msg={errors.firstName?.message} />
              </div>
              <div>
                <FieldLabel required htmlFor="c-lname">
                  Apellidos
                </FieldLabel>
                <FieldInput
                  id="c-lname"
                  placeholder="Apellidos"
                  hasError={!!errors.lastName}
                  {...register("lastName")}
                />
                <FieldError msg={errors.lastName?.message} />
              </div>
            </div>
            <div>
              <FieldLabel required htmlFor="c-email">
                Correo electrónico
              </FieldLabel>
              <FieldInput
                id="c-email"
                type="email"
                autoComplete="off"
                placeholder="correo@institución.com"
                hasError={!!errors.email}
                {...register("email")}
              />
              <FieldError msg={errors.email?.message} />
            </div>
          </div>

          {/* Access */}
          <div>
            <SectionDivider title="Acceso al sistema" />
            <div className="mb-4">
              <FieldLabel required>Rol</FieldLabel>
              <RoleSelectField
                value={role}
                onChange={(r) => {
                  setRole(r)
                  setRoleError("")
                }}
                errorMsg={roleError}
              />
            </div>

            <div
              className="flex items-center justify-between rounded-xl p-3"
              style={{ backgroundColor: "#0f1f3a" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "#f0ede8" }}>
                  Estado inicial
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
                  {status === "ACTIVE"
                    ? "El usuario podrá acceder de inmediato"
                    : "El usuario no podrá acceder hasta ser activado"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="text-xs"
                  style={{
                    color: status === "ACTIVE" ? "#22c55e" : "#8a9bb5",
                  }}
                >
                  {status === "ACTIVE" ? "Activo" : "Inactivo"}
                </span>
                <Toggle
                  checked={status === "ACTIVE"}
                  onChange={(v) => setStatus(v ? "ACTIVE" : "INACTIVE")}
                />
              </div>
            </div>
          </div>

          {/* Temp password */}
          <div>
            <SectionDivider title="Contraseña temporal" />
            <FieldLabel required>Contraseña temporal</FieldLabel>
            <PasswordField
              value={password}
              onChange={(v) => {
                setPassword(v)
                setPwTouched(true)
              }}
              withGenerate
              hasError={pwTouched && !passwordIsValid(password)}
            />
            {(password || pwTouched) && (
              <div className="mt-3 space-y-3">
                <PasswordStrengthBar password={password} />
                <PasswordChecklist password={password} />
              </div>
            )}
            <p className="mt-2 text-xs" style={{ color: "#4a6080" }}>
              El usuario deberá cambiarla en su primer inicio de sesión.
            </p>
          </div>

          {/* Security */}
          <div>
            <SectionDivider title="Seguridad" />
            <div
              className="flex items-start justify-between rounded-xl p-3"
              style={{ backgroundColor: "#0f1f3a" }}
            >
              <div className="flex-1 pr-4">
                <p className="text-sm font-medium" style={{ color: "#f0ede8" }}>
                  Autenticación de dos factores
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
                  {requires2FA
                    ? "Requerido para este rol. No puede desactivarse."
                    : "Recomendado para mayor seguridad."}
                </p>
              </div>
              <Toggle
                checked={twoFactor}
                onChange={setTwoFactor}
                disabled={requires2FA}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: "1px solid #1b2e4a" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-[#1b2e4a]"
            style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit(submit)}
            disabled={submitting}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
            )}
            style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
          >
            {submitting ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────
function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: MockUser
  onClose: () => void
  onSaved: (u: MockUser) => void
}) {
  const [role, setRole] = useState<Role>(user.role)
  const [status, setStatus] = useState<UserStatus>(user.status === "BLOCKED" ? "BLOCKED" : user.status)
  const [twoFactor, setTwoFactor] = useState(user.twoFactor)
  const [showPwSection, setShowPwSection] = useState(false)
  const [newPassword, setNewPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const requires2FA = ROLE_REQUIRES_2FA[role]
  useEffect(() => {
    if (requires2FA) setTwoFactor(true)
  }, [requires2FA])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditData>({
    resolver: zodResolver(editSchema),
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  })

  const submit = async (data: EditData) => {
    if (showPwSection && newPassword && !passwordIsValid(newPassword)) return
    setSubmitting(true)
    await new Promise((r) => setTimeout(r, 700))
    const updated: MockUser = {
      ...user,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role,
      status,
      twoFactor,
    }
    onSaved(updated)
    toast.success("Cambios guardados correctamente.")
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,13,28,0.85)" }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl"
        style={{
          backgroundColor: "#0a1628",
          border: "1px solid #1b2e4a",
          boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid #1b2e4a" }}
        >
          <div>
            <h2
              className="text-[22px]"
              style={{
                fontFamily: "DM Serif Display, serif",
                color: "#f0ede8",
                fontWeight: 400,
              }}
            >
              Editar Usuario
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
              {user.firstName} {user.lastName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 transition-colors hover:bg-[#1b2e4a]"
            style={{ color: "#4a6080" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Personal info */}
          <div>
            <SectionDivider title="Información personal" />
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required htmlFor="e-fname">
                  Nombre(s)
                </FieldLabel>
                <FieldInput
                  id="e-fname"
                  hasError={!!errors.firstName}
                  {...register("firstName")}
                />
                <FieldError msg={errors.firstName?.message} />
              </div>
              <div>
                <FieldLabel required htmlFor="e-lname">
                  Apellidos
                </FieldLabel>
                <FieldInput
                  id="e-lname"
                  hasError={!!errors.lastName}
                  {...register("lastName")}
                />
                <FieldError msg={errors.lastName?.message} />
              </div>
            </div>
            {/* Email non-editable */}
            <div>
              <FieldLabel htmlFor="e-email">Correo electrónico</FieldLabel>
              <div
                id="e-email"
                className="flex h-10 items-center rounded-lg border px-3 text-sm"
                style={{
                  borderColor: "#1b2e4a",
                  backgroundColor: "#060e1e",
                  color: "#4a6080",
                }}
              >
                {user.email}
              </div>
              <p className="mt-1 text-xs" style={{ color: "#4a6080" }}>
                El correo no puede modificarse.
              </p>
            </div>
          </div>

          {/* Access */}
          <div>
            <SectionDivider title="Acceso al sistema" />
            <div className="mb-4">
              <FieldLabel>Rol</FieldLabel>
              <RoleSelectField value={role} onChange={setRole} />
            </div>

            {/* Status toggle — only ACTIVE / INACTIVE in edit */}
            {user.status !== "BLOCKED" && (
              <div
                className="flex items-center justify-between rounded-xl p-3"
                style={{ backgroundColor: "#0f1f3a" }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#f0ede8" }}
                  >
                    Estado de la cuenta
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
                    {status === "ACTIVE"
                      ? "El usuario puede acceder al sistema"
                      : "El usuario no tiene acceso al sistema"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs"
                    style={{
                      color: status === "ACTIVE" ? "#22c55e" : "#8a9bb5",
                    }}
                  >
                    {status === "ACTIVE" ? "Activo" : "Inactivo"}
                  </span>
                  <Toggle
                    checked={status === "ACTIVE"}
                    onChange={(v) => setStatus(v ? "ACTIVE" : "INACTIVE")}
                  />
                </div>
              </div>
            )}
            {user.status === "BLOCKED" && (
              <div
                className="rounded-xl p-3"
                style={{
                  backgroundColor: "rgba(224,82,82,0.08)",
                  border: "1px solid rgba(224,82,82,0.25)",
                }}
              >
                <p className="text-sm" style={{ color: "#e05252" }}>
                  Esta cuenta está bloqueada. Para reactivarla usa el botón de
                  desbloqueo en la tabla.
                </p>
              </div>
            )}
          </div>

          {/* Password reset (collapsible) */}
          <div>
            <SectionDivider title="Contraseña" />
            <button
              type="button"
              onClick={() => setShowPwSection((p) => !p)}
              className="flex w-full items-center gap-2 text-sm transition-colors hover:text-[#c9a84c]"
              style={{ color: "#8a9bb5" }}
            >
              {showPwSection ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronExpand size={14} />
              )}
              Restablecer contraseña del usuario
            </button>

            {showPwSection && (
              <div className="mt-3 space-y-3">
                <FieldLabel>Nueva contraseña temporal (opcional)</FieldLabel>
                <PasswordField
                  value={newPassword}
                  onChange={setNewPassword}
                  withGenerate
                  hasError={
                    newPassword.length > 0 && !passwordIsValid(newPassword)
                  }
                />
                {newPassword && (
                  <>
                    <PasswordStrengthBar password={newPassword} />
                    <PasswordChecklist password={newPassword} />
                  </>
                )}
                <p className="text-xs" style={{ color: "#4a6080" }}>
                  Dejar vacío para mantener la contraseña actual.
                </p>
              </div>
            )}
          </div>

          {/* Security */}
          <div>
            <SectionDivider title="Seguridad" />
            <div
              className="flex items-start justify-between rounded-xl p-3"
              style={{ backgroundColor: "#0f1f3a" }}
            >
              <div className="flex-1 pr-4">
                <p
                  className="text-sm font-medium"
                  style={{ color: "#f0ede8" }}
                >
                  Autenticación de dos factores
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
                  {requires2FA
                    ? "Requerido para este rol. No puede desactivarse."
                    : "Recomendado para mayor seguridad."}
                </p>
              </div>
              <Toggle
                checked={twoFactor}
                onChange={setTwoFactor}
                disabled={requires2FA}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4"
          style={{ borderTop: "1px solid #1b2e4a" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-[#1b2e4a]"
            style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit(submit)}
            disabled={submitting}
            className={cn(
              "flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all",
              "hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
            )}
            style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Confirm Dialog ────────────────────────────────────────────────────
function StatusConfirmDialog({
  user,
  onConfirm,
  onCancel,
}: {
  user: MockUser
  onConfirm: () => void
  onCancel: () => void
}) {
  const isActivating = user.status !== "ACTIVE"
  const fullName = `${user.firstName} ${user.lastName}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,13,28,0.85)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          backgroundColor: "#0a1628",
          border: "1px solid #1b2e4a",
          boxShadow: "0 4px 40px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: isActivating
              ? "rgba(34,197,94,0.12)"
              : "rgba(224,82,82,0.12)",
          }}
        >
          {isActivating ? (
            <Unlock size={22} style={{ color: "#22c55e" }} />
          ) : (
            <Lock size={22} style={{ color: "#e05252" }} />
          )}
        </div>

        <h3
          className="mb-3 text-center text-lg"
          style={{
            fontFamily: "DM Serif Display, serif",
            color: "#f0ede8",
            fontWeight: 400,
          }}
        >
          {isActivating ? "Reactivar cuenta" : "Desactivar cuenta"}
        </h3>

        <p
          className="mb-6 text-center text-sm leading-relaxed"
          style={{ color: "#8a9bb5" }}
        >
          {isActivating
            ? `¿Confirmas que deseas reactivar la cuenta de ${fullName}? El usuario podrá acceder al sistema nuevamente.`
            : `¿Confirmas que deseas desactivar la cuenta de ${fullName}? El usuario perderá el acceso inmediatamente.`}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-[#1b2e4a]"
            style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all hover:brightness-110"
            style={{
              backgroundColor: isActivating ? "#22c55e" : "#e05252",
              color: "#fff",
            }}
          >
            {isActivating ? "Reactivar" : "Desactivar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Format date helper ───────────────────────────────────────────────────────
function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleDateString("es-PA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

function UsersPage() {
  const [users, setUsers] = useState<MockUser[]>(MOCK_USERS_INITIAL)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<Role | "">("")
  const [statusFilter, setStatusFilter] = useState<UserStatus | "">("")
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<MockUser | null>(null)
  const [statusTarget, setStatusTarget] = useState<MockUser | null>(null)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, roleFilter, statusFilter])

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase()
    return users.filter((u) => {
      const name = `${u.firstName} ${u.lastName}`.toLowerCase()
      const matchQ = !q || name.includes(q) || u.email.toLowerCase().includes(q)
      const matchRole = !roleFilter || u.role === roleFilter
      const matchStatus = !statusFilter || u.status === statusFilter
      return matchQ && matchRole && matchStatus
    })
  }, [users, searchTerm, roleFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === "ACTIVE").length,
      with2fa: users.filter((u) => u.twoFactor).length,
      blocked: users.filter((u) => u.status === "BLOCKED").length,
    }),
    [users],
  )

  const handleCreated = (u: MockUser) =>
    setUsers((prev) => [u, ...prev])

  const handleSaved = (updated: MockUser) =>
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))

  const confirmStatusToggle = () => {
    if (!statusTarget) return
    const next: UserStatus =
      statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setUsers((prev) =>
      prev.map((u) =>
        u.id === statusTarget.id ? { ...u, status: next } : u,
      ),
    )
    toast.success(
      `Cuenta de ${statusTarget.firstName} ${statusTarget.lastName} ${next === "ACTIVE" ? "reactivada" : "desactivada"}.`,
    )
    setStatusTarget(null)
  }

  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-[28px]"
            style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8", fontWeight: 400 }}
          >
            Gestión de Usuarios
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "#4a6080" }}>
            Administra cuentas, roles y permisos del sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { icon: <Users size={20} />, label: "Total", value: stats.total, color: "#c9a84c" },
          { icon: <UserCheck size={20} />, label: "Activos", value: stats.active, color: "#22c55e" },
          { icon: <ShieldCheck size={20} />, label: "Con 2FA", value: stats.with2fa, color: "#60a5fa" },
          { icon: <ShieldAlert size={20} />, label: "Bloqueados", value: stats.blocked, color: "#e05252" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-4 rounded-xl p-4"
            style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
          >
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${s.color}18`, color: s.color }}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-2xl font-semibold" style={{ color: "#f0ede8" }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: "#4a6080" }}>
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "#4a6080" }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o correo…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm text-[#f0ede8] placeholder:text-[#4a6080] outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c] focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]"
            style={{ backgroundColor: "#0f1f3a" }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          className="h-10 rounded-lg border px-3 text-sm outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a", color: roleFilter ? "#f0ede8" : "#4a6080" }}
        >
          <option value="">Todos los roles</option>
          {ROLE_VALUES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | "")}
          className="h-10 rounded-lg border px-3 text-sm outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a", color: statusFilter ? "#f0ede8" : "#4a6080" }}
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
          <option value="BLOCKED">Bloqueados</option>
        </select>

        {(searchInput || roleFilter || statusFilter) && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("")
              setRoleFilter("")
              setStatusFilter("")
            }}
            className="flex items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-[#1b2e4a]"
            style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
          >
            <X size={13} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="overflow-hidden rounded-xl"
        style={{ border: "1px solid #1b2e4a" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#0f1f3a", borderBottom: "1px solid #1b2e4a" }}>
                {["#", "Nombre", "Correo", "Rol", "Estado", "2FA", "Último acceso", "Acciones"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#4a6080" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm"
                    style={{ color: "#4a6080" }}
                  >
                    No se encontraron usuarios con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginated.map((u, i) => (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-[#0f1f3a]"
                    style={{ borderBottom: "1px solid #1b2e4a" }}
                  >
                    <td className="px-4 py-3.5" style={{ color: "#4a6080" }}>
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-medium" style={{ color: "#f0ede8" }}>
                        {u.firstName} {u.lastName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs" style={{ color: "#8a9bb5" }}>
                        {u.email}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      {u.twoFactor ? (
                        <ShieldCheck size={16} style={{ color: "#22c55e" }} />
                      ) : (
                        <span style={{ color: "#1b2e4a" }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: "#8a9bb5" }}>
                      {fmtDate(u.lastAccess)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditUser(u)}
                          aria-label={`Editar ${u.firstName}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#1b2e4a]"
                          style={{ color: "#8a9bb5" }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTarget(u)}
                          aria-label={
                            u.status === "ACTIVE"
                              ? `Desactivar ${u.firstName}`
                              : `Activar ${u.firstName}`
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#1b2e4a]"
                          style={{
                            color: u.status === "ACTIVE" ? "#e05252" : "#22c55e",
                          }}
                        >
                          {u.status === "ACTIVE" ? (
                            <Lock size={14} />
                          ) : (
                            <Unlock size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid #1b2e4a", backgroundColor: "#0f1f3a" }}
        >
          <p className="text-xs" style={{ color: "#4a6080" }}>
            {filtered.length === 0
              ? "Sin resultados"
              : `Mostrando ${rangeStart}–${rangeEnd} de ${filtered.length} usuario${filtered.length !== 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Página anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#1b2e4a] disabled:opacity-40"
              style={{ color: "#8a9bb5" }}
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors"
                style={
                  p === page
                    ? { backgroundColor: "#c9a84c", color: "#040d1c", fontWeight: 600 }
                    : { color: "#8a9bb5" }
                }
              >
                {p}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Página siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#1b2e4a] disabled:opacity-40"
              style={{ color: "#8a9bb5" }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {createOpen && (
        <CreateUserModal
          onClose={() => setCreateOpen(false)}
          existingEmails={users.map((u) => u.email)}
          onCreated={handleCreated}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={handleSaved}
        />
      )}
      {statusTarget && (
        <StatusConfirmDialog
          user={statusTarget}
          onConfirm={confirmStatusToggle}
          onCancel={() => setStatusTarget(null)}
        />
      )}
    </div>
  )
}
