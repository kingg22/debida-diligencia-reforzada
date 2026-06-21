import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  User,
} from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  ClientesService,
  type CreateExpedienteInput,
  SgddrApiError,
} from "@/client/sgddr"
import { cn } from "@/lib/utils"

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/_layout/kyc/nuevo")({
  component: KYCNuevoCliente,
  head: () => ({
    meta: [{ title: "Nuevo Cliente KYC — PanamaCompliance SGDDR" }],
  }),
})

// ─── Types ────────────────────────────────────────────────────────────────────
type TipoPersona = "NATURAL" | "JURIDICA"
type NivelRiesgo = "ALTO" | "MEDIO" | "BAJO"
type FormErrors = Record<string, string>

interface BeneficiarioFinalForm {
  id: string // local-only React key (no se envía al backend)
  nombre: string
  apellido: string
  tipo_identificacion: "CEDULA_PA" | "PASAPORTE"
  numero_identificacion: string
  fecha_nacimiento: string
  porcentaje_participacion: string
  tipo_control: "DIRECTA" | "INDIRECTA" | "OTRO"
  pais_residencia: string
  es_pep: boolean
}

function emptyBeneficiario(): BeneficiarioFinalForm {
  return {
    id: Math.random().toString(36).slice(2),
    nombre: "",
    apellido: "",
    tipo_identificacion: "CEDULA_PA",
    numero_identificacion: "",
    fecha_nacimiento: "",
    porcentaje_participacion: "",
    tipo_control: "DIRECTA",
    pais_residencia: "Panamá",
    es_pep: false,
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAISES = [
  "Panamá",
  "Estados Unidos",
  "Colombia",
  "México",
  "Venezuela",
  "España",
  "Argentina",
  "Brasil",
  "Chile",
  "Perú",
  "Ecuador",
  "Costa Rica",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Cuba",
  "República Dominicana",
  "China",
  "Reino Unido",
  "Francia",
  "Alemania",
  "Italia",
  "Canadá",
  "Rusia",
  "Israel",
  "Arabia Saudita",
  "Emiratos Árabes Unidos",
  "Japón",
  "Otro",
]

const ACTIVIDADES_CIIU = [
  "Actividades bancarias y financieras",
  "Servicios jurídicos y contables",
  "Actividades de agentes residentes",
  "Comercio al por mayor",
  "Comercio al por menor",
  "Construcción e inmobiliaria",
  "Transporte y logística",
  "Salud y servicios médicos",
  "Educación",
  "Tecnología e informática",
  "Minería y recursos naturales",
  "Agricultura y ganadería",
  "Turismo y hotelería",
  "Manufactura e industria",
  "Medios de comunicación",
  "Otro",
]

const STEPS = [
  { num: 1, label: "Identificación" },
  { num: 2, label: "Información" },
  { num: 3, label: "Documentos" },
  { num: 4, label: "Revisión" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcularNivelRiesgo(params: {
  esPep: boolean
  nacionalidad: string
  tipoPersona: TipoPersona
  beneficiarios: BeneficiarioFinalForm[]
}): NivelRiesgo {
  if (params.esPep) return "ALTO"
  if (params.beneficiarios.some((b) => b.es_pep)) return "ALTO"
  if (params.tipoPersona === "NATURAL" && params.nacionalidad !== "Panamá")
    return "MEDIO"
  if (params.tipoPersona === "JURIDICA" && params.beneficiarios.length > 2)
    return "MEDIO"
  return "BAJO"
}

function validarCedulaPA(v: string) {
  return /^[0-9]{1,2}-[0-9]{3,4}-[0-9]{1,4}$/.test(v)
}

function calcularEdad(fecha: string) {
  const hoy = new Date()
  const nac = new Date(fecha)
  let e = hoy.getFullYear() - nac.getFullYear()
  const m = hoy.getMonth() - nac.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--
  return e
}

function maxFechaNac() {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 18)
  return d.toISOString().split("T")[0]
}

// Mapea el "rol" de documento del formulario al enum `DocumentoTipo` del
// backend. Mantener este mapping en un único punto evita typos y facilita
// añadir nuevos tipos en el futuro.
function tipoDocumentoBackend(
  rol: "identidad" | "domicilio" | "constitucion" | "poder",
  tipoPersona: TipoPersona,
  tipoIdNatural: "CEDULA_PA" | "PASAPORTE",
): string {
  if (rol === "identidad") {
    if (tipoPersona === "JURIDICA") return "RUC"
    return tipoIdNatural === "CEDULA_PA" ? "CEDULA_FRONTAL" : "PASAPORTE"
  }
  if (rol === "domicilio") return "OTRO"
  if (rol === "constitucion") return "ESCRITURA_CONSTITUCION"
  if (rol === "poder") return "PODER_REPRESENTANTE"
  return "OTRO"
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────
function Field({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className="mb-1.5 block text-sm font-medium"
        style={{ color: "#8a9bb5" }}
      >
        {label} {required && <span style={{ color: "#e05252" }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs" style={{ color: "#4a6080" }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "#e05252" }}>
          {error}
        </p>
      )}
    </div>
  )
}

function StyledInput({
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border px-4 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
        "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
        "disabled:opacity-50",
        error
          ? "border-[#e05252] focus:border-[#e05252]"
          : "border-[#1b2e4a] focus:border-[#c9a84c]",
      )}
      style={{ backgroundColor: "#0f1f3a" }}
    />
  )
}

function StyledSelect({
  error,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <select
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border px-4 text-sm text-[#f0ede8]",
        "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
        error
          ? "border-[#e05252] focus:border-[#e05252]"
          : "border-[#1b2e4a] focus:border-[#c9a84c]",
      )}
      style={{ backgroundColor: "#0f1f3a" }}
    >
      {children}
    </select>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "rgba(201,168,76,0.12)",
          border: "1px solid rgba(201,168,76,0.25)",
        }}
      >
        <Icon size={16} style={{ color: "#c9a84c" }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: "#f0ede8" }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs" style={{ color: "#4a6080" }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  danger,
}: {
  checked: boolean
  onChange: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors"
      style={{
        backgroundColor: checked ? (danger ? "#e05252" : "#c9a84c") : "#1b2e4a",
      }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
      />
    </button>
  )
}

function RiskBadge({ nivel }: { nivel: NivelRiesgo }) {
  const cfg = {
    ALTO: { c: "#e05252", bg: "rgba(224,82,82,0.12)", label: "Alto Riesgo" },
    MEDIO: { c: "#d97706", bg: "rgba(217,119,6,0.12)", label: "Riesgo Medio" },
    BAJO: { c: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Riesgo Bajo" },
  }[nivel]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.c }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cfg.c }}
      />
      {cfg.label}
    </span>
  )
}

// ─── DropZone (top-level component — hooks OK here) ───────────────────────────
function DropZone({
  label,
  hint,
  file,
  onFile,
  required,
  error,
}: {
  label: string
  hint: string
  file: File | null
  onFile: (f: File) => void
  required?: boolean
  error?: string
}) {
  const ref = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera los 10 MB permitidos")
      return
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png"]
    if (!allowed.includes(f.type)) {
      toast.error("Solo se permiten archivos PDF, JPG o PNG")
      return
    }
    onFile(f)
  }

  return (
    <Field label={label} required={required} error={error}>
      <div
        onClick={() => ref.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-6 transition-all",
          "hover:border-[#c9a84c]",
          file
            ? "border-[#22c55e]"
            : error
              ? "border-[#e05252]"
              : "border-[#1b2e4a]",
        )}
        style={{ backgroundColor: "#0a1628" }}
      >
        {file ? (
          <>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
            >
              <CheckCircle size={20} style={{ color: "#22c55e" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: "#22c55e" }}>
                {file.name}
              </p>
              <p className="text-xs" style={{ color: "#4a6080" }}>
                {(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar
              </p>
            </div>
          </>
        ) : (
          <>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "#0f1f3a" }}
            >
              <Upload size={18} style={{ color: "#4a6080" }} />
            </div>
            <div className="text-center">
              <p className="text-sm" style={{ color: "#8a9bb5" }}>
                Haz clic para seleccionar
              </p>
              <p className="text-xs" style={{ color: "#4a6080" }}>
                {hint}
              </p>
            </div>
          </>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleChange}
      />
    </Field>
  )
}

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((s, i) => (
        <div key={s.num} className="flex flex-1 items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all",
                s.num < current
                  ? ""
                  : s.num === current
                    ? "ring-2 ring-[#c9a84c] ring-offset-2 ring-offset-[#040d1c]"
                    : "",
              )}
              style={{
                backgroundColor:
                  s.num < current
                    ? "#22c55e"
                    : s.num === current
                      ? "#c9a84c"
                      : "#0a1628",
                color: s.num <= current ? "#040d1c" : "#4a6080",
                border: s.num > current ? "1px solid #1b2e4a" : "none",
              }}
            >
              {s.num < current ? <CheckCircle size={15} /> : s.num}
            </div>
            <span
              className="mt-1.5 whitespace-nowrap text-xs font-medium"
              style={{
                color:
                  s.num === current
                    ? "#c9a84c"
                    : s.num < current
                      ? "#22c55e"
                      : "#4a6080",
              }}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-3 mb-5 h-px flex-1 transition-all"
              style={{
                backgroundColor: s.num < current ? "#22c55e" : "#1b2e4a",
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
function KYCNuevoCliente() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<FormErrors>({})

  // ── Tipo de persona ──
  const [tipoPersona, setTipoPersona] = useState<TipoPersona | null>(null)

  // ── Paso 1 — Persona Natural ──
  const [tipoIdNatural, setTipoIdNatural] = useState<"CEDULA_PA" | "PASAPORTE">(
    "CEDULA_PA",
  )
  const [numIdNatural, setNumIdNatural] = useState("")
  const [nombres, setNombres] = useState("")
  const [apellidos, setApellidos] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")

  // ── Paso 1 — Persona Jurídica ──
  const [razonSocial, setRazonSocial] = useState("")
  const [ruc, setRuc] = useState("")
  const [fechaConstitucion, setFechaConstitucion] = useState("")

  // ── Paso 2 — Natural ──
  const [nacionalidad, setNacionalidad] = useState("Panamá")
  const [paisResidencia, setPaisResidencia] = useState("Panamá")
  const [correo, setCorreo] = useState("")
  const [telefono, setTelefono] = useState("+507-")
  const [ocupacion, setOcupacion] = useState("")
  const [ingresoMensual, setIngresoMensual] = useState("")
  const [fuenteIngresos, setFuenteIngresos] = useState("")
  const [esPep, setEsPep] = useState(false)

  // ── Paso 2 — Jurídica ──
  const [paisConstitucion, setPaisConstitucion] = useState("Panamá")
  const [actividadEconomica, setActividadEconomica] = useState("")
  const [tipoSociedad, setTipoSociedad] = useState("SOCIEDAD_ANONIMA")
  const [numeroRegistroMercantil, setNumeroRegistroMercantil] = useState("")
  const [direccionFiscal, setDireccionFiscal] = useState("")
  const [ciudadEmpresa, setCiudadEmpresa] = useState("")
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("")
  const [emailEmpresa, setEmailEmpresa] = useState("")
  const [representanteLegal, setRepresentanteLegal] = useState("")
  const [idRepresentante, setIdRepresentante] = useState("")
  const [cargoRepresentante, setCargoRepresentante] = useState("REPRESENTANTE_LEGAL")
  // Los beneficiarios finales son obligatorios para Persona Jurídica
  // (Ley 254/2021 Art. 3). Se siembra con una fila vacía al elegir JURIDICA.
  const [beneficiarios, setBeneficiarios] = useState<BeneficiarioFinalForm[]>([])

  // ── Paso 3 — Documentos ──
  const [docIdentidad, setDocIdentidad] = useState<File | null>(null)
  const [docDomicilio, setDocDomicilio] = useState<File | null>(null)
  const [docConstitucion, setDocConstitucion] = useState<File | null>(null)
  const [docPoder, setDocPoder] = useState<File | null>(null)

  // ── Computed ──
  const nivelRiesgo: NivelRiesgo = calcularNivelRiesgo({
    esPep,
    nacionalidad,
    tipoPersona: tipoPersona ?? "NATURAL",
    beneficiarios,
  })

  const totalPorcentajeBF = beneficiarios.reduce(
    (s, b) => s + (parseFloat(b.porcentaje_participacion) || 0),
    0,
  )

  // ── Beneficiarios helpers ──
  const addBeneficiario = () =>
    setBeneficiarios((prev) => [...prev, emptyBeneficiario()])

  const removeBeneficiario = (id: string) =>
    setBeneficiarios((prev) => prev.filter((b) => b.id !== id))

  const updateBF = (
    id: string,
    key: keyof BeneficiarioFinalForm,
    val: string | boolean,
  ) =>
    setBeneficiarios((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [key]: val } : b)),
    )

  // ── Validation ──
  const validateStep1 = (): boolean => {
    const e: FormErrors = {}
    if (!tipoPersona) {
      e.tipoPersona = "Selecciona el tipo de persona"
    } else if (tipoPersona === "NATURAL") {
      if (!numIdNatural.trim())
        e.numIdNatural = "El número de identificación es requerido"
      else if (tipoIdNatural === "CEDULA_PA" && !validarCedulaPA(numIdNatural))
        e.numIdNatural = "Formato inválido. Ejemplo: 8-123-4567"
      if (!nombres.trim()) e.nombres = "El nombre es requerido"
      else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(nombres.trim()))
        e.nombres = "Solo letras y espacios"
      if (!apellidos.trim()) e.apellidos = "Los apellidos son requeridos"
      else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/.test(apellidos.trim()))
        e.apellidos = "Solo letras y espacios"
      if (!fechaNacimiento)
        e.fechaNacimiento = "La fecha de nacimiento es requerida"
      else if (calcularEdad(fechaNacimiento) < 18)
        e.fechaNacimiento = "El cliente debe ser mayor de 18 años"
    } else {
      if (!razonSocial.trim()) e.razonSocial = "La razón social es requerida"
      if (!ruc.trim()) e.ruc = "El RUC es requerido"
      if (!fechaConstitucion)
        e.fechaConstitucion = "La fecha de constitución es requerida"
      else if (new Date(fechaConstitucion) > new Date())
        e.fechaConstitucion = "La fecha no puede ser futura"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep2 = (): boolean => {
    const e: FormErrors = {}
    if (tipoPersona === "NATURAL") {
      if (!correo.trim()) e.correo = "El correo es requerido"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))
        e.correo = "Formato de correo inválido"
      if (!telefono.trim() || telefono === "+507-")
        e.telefono = "El teléfono es requerido"
      if (!ocupacion.trim()) e.ocupacion = "La ocupación es requerida"
      if (!ingresoMensual || parseFloat(ingresoMensual) < 0)
        e.ingresoMensual = "Ingresa un ingreso mensual válido"
      if (!fuenteIngresos) e.fuenteIngresos = "Selecciona la fuente de ingresos"
    } else {
      if (!actividadEconomica)
        e.actividadEconomica = "La actividad económica es requerida"
      if (!numeroRegistroMercantil.trim())
        e.numeroRegistroMercantil = "El número de registro mercantil es requerido"
      if (!direccionFiscal.trim())
        e.direccionFiscal = "La dirección fiscal es requerida"
      if (!ciudadEmpresa.trim())
        e.ciudadEmpresa = "La ciudad es requerida"
      if (!telefonoEmpresa.trim())
        e.telefonoEmpresa = "El teléfono de la empresa es requerido"
      if (!emailEmpresa.trim())
        e.emailEmpresa = "El correo de la empresa es requerido"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEmpresa))
        e.emailEmpresa = "Formato de correo inválido"
      if (!representanteLegal.trim())
        e.representanteLegal = "El nombre del representante es requerido"
      if (!idRepresentante.trim())
        e.idRepresentante = "La identificación del representante es requerida"

      // Beneficiarios finales: Ley 254/2021 — obligatorios para Persona Jurídica.
      if (beneficiarios.length === 0)
        e.beneficiarios = "Debe registrar al menos un Beneficiario Final"
      beneficiarios.forEach((bf, i) => {
        if (!bf.nombre.trim()) e[`bf_${i}_nombre`] = "Requerido"
        if (!bf.apellido.trim()) e[`bf_${i}_apellido`] = "Requerido"
        if (!bf.numero_identificacion.trim())
          e[`bf_${i}_id`] = "Requerido"
        if (!bf.fecha_nacimiento)
          e[`bf_${i}_nac`] = "Requerida"
        const pct = parseFloat(bf.porcentaje_participacion)
        if (Number.isNaN(pct) || pct < 0 || pct > 100)
          e[`bf_${i}_pct`] = "Valor entre 0% y 100%"
      })
      if (beneficiarios.length > 0 && Math.round(totalPorcentajeBF) !== 100) {
        const delta = Math.round(100 - totalPorcentajeBF)
        const signo = delta > 0 ? "Falta" : "Sobra"
        e.totalPct = `La suma debe ser exactamente 100%. Actual: ${Math.round(
          totalPorcentajeBF,
        )}%. ${signo} ${Math.abs(delta)}%.`
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateStep3 = (): boolean => {
    const e: FormErrors = {}
    if (!docIdentidad)
      e.docIdentidad = "El documento de identidad es obligatorio (RV-07)"
    if (tipoPersona === "NATURAL" && !docDomicilio)
      e.docDomicilio = "El comprobante de domicilio es obligatorio (RV-07)"
    if (tipoPersona === "JURIDICA" && !docConstitucion)
      e.docConstitucion = "La escritura de constitución es obligatoria"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    const ok =
      step === 1
        ? validateStep1()
        : step === 2
          ? validateStep2()
          : step === 3
            ? validateStep3()
            : true
    if (ok) {
      setStep((s) => s + 1)
      setErrors({})
    }
  }

  const handleBack = () => {
    setStep((s) => s - 1)
    setErrors({})
  }

  // ── Submit real contra la API ────────────────────────────────────────────
  // Crea el expediente KYC (POST /api/v1/clientes) y, si el backend lo
  // aceptó, sube los documentos asociados (POST /api/v1/clientes/{id}/documentos).
  const crearExpediente = useMutation({
    mutationFn: async () => {
      if (!tipoPersona) throw new Error("Tipo de persona no seleccionado")

      const baseBeneficiarios =
        tipoPersona === "JURIDICA"
          ? beneficiarios.map((b) => ({
              nombre: b.nombre.trim(),
              apellido: b.apellido.trim(),
              cedula: b.numero_identificacion,
              nacionalidad: b.pais_residencia,
              pais: b.pais_residencia,
              fecha_nacimiento: b.fecha_nacimiento,
              porcentaje_participacion:
                parseFloat(b.porcentaje_participacion) || 0,
              es_pep: b.es_pep,
            }))
          : []

      let payload: CreateExpedienteInput

      if (tipoPersona === "NATURAL") {
        payload = {
          tipo_cliente: "NATURAL",
          enviar_a_revision: true,
          persona_natural: {
            tipo_documento: tipoIdNatural,
            numero_documento: numIdNatural,
            fecha_expiracion_doc: "",
            nacionalidad,
            pais_nacimiento: paisResidencia,
            nombre: nombres,
            apellido: apellidos,
            fecha_nacimiento: fechaNacimiento,
            genero: "OTRO",
            estado_civil: "SOLTERO",
            telefono,
            email: correo,
            direccion: "—",
            ciudad: "—",
            pais: paisResidencia,
            ocupacion,
            empleador: "—",
            ingreso_mensual_aproximado: parseFloat(ingresoMensual) || 0,
            fuente_ingresos: fuenteIngresos || "OTRO",
            es_pep: esPep,
            es_pep_familiar: false,
            tiene_antecedentes: false,
          },
          beneficiarios_final: [],
        }
      } else {
        payload = {
          tipo_cliente: "JURIDICA",
          enviar_a_revision: true,
          persona_juridica: {
            razon_social: razonSocial,
            ruc,
            tipo_sociedad: tipoSociedad,
            fecha_constitucion: fechaConstitucion,
            pais_constitucion: paisConstitucion,
            numero_registro_mercantil: numeroRegistroMercantil,
            nombre_representante: representanteLegal,
            cedula_representante: idRepresentante,
            cargo_representante: cargoRepresentante,
            telefono_empresa: telefonoEmpresa,
            email_empresa: emailEmpresa,
            direccion_fiscal: direccionFiscal,
            ciudad: ciudadEmpresa,
            pais: paisConstitucion,
            actividad_economica: actividadEconomica,
            ingreso_anual_aproximado: 0,
            cantidad_empleados: 0,
            tiene_accionistas_anonimos: false,
            opera_en_paises_alto_riesgo: false,
          },
          beneficiarios_final: baseBeneficiarios,
        }
      }

      // 1) Crear expediente
      const expediente = await ClientesService.create(payload)

      // 2) Subir documentos (no abortamos si alguno falla: el expediente ya
      // existe; el analista podrá reintentar desde el detalle).
      const uploads: Array<Promise<unknown>> = []
      if (docIdentidad) {
        uploads.push(
          ClientesService.subirDocumento(
            expediente.id,
            tipoDocumentoBackend("identidad", tipoPersona, tipoIdNatural),
            docIdentidad,
          ),
        )
      }
      if (tipoPersona === "NATURAL" && docDomicilio) {
        uploads.push(
          ClientesService.subirDocumento(expediente.id, "OTRO", docDomicilio),
        )
      }
      if (tipoPersona === "JURIDICA" && docConstitucion) {
        uploads.push(
          ClientesService.subirDocumento(
            expediente.id,
            tipoDocumentoBackend("constitucion", tipoPersona, tipoIdNatural),
            docConstitucion,
          ),
        )
      }
      if (tipoPersona === "JURIDICA" && docPoder) {
        uploads.push(
          ClientesService.subirDocumento(
            expediente.id,
            tipoDocumentoBackend("poder", tipoPersona, tipoIdNatural),
            docPoder,
          ),
        )
      }
      await Promise.all(uploads)

      return expediente
    },
    onSuccess: (expediente) => {
      const nombre =
        tipoPersona === "NATURAL" ? `${nombres} ${apellidos}` : razonSocial
      toast.success(
        `Expediente ${expediente.codigo} creado para ${nombre}. ` +
          "Pendiente de revisión por el Oficial de Cumplimiento.",
      )
      navigate({
        to: "/clientes/$id",
        params: { id: expediente.id },
      })
    },
    onError: (e: Error) => {
      const msg =
        e instanceof SgddrApiError
          ? e.detail
          : e.message || "No se pudo crear el expediente"
      toast.error(msg)
    },
  })

  const submitting = crearExpediente.isPending

  const handleSubmit = () => {
    crearExpediente.mutate()
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 1 — Identificación
  // ──────────────────────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Tipo persona selector */}
      <div>
        <p className="mb-3 text-sm font-medium" style={{ color: "#8a9bb5" }}>
          Tipo de persona <span style={{ color: "#e05252" }}>*</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          {(
            [
              {
                value: "NATURAL",
                icon: User,
                label: "Persona Natural",
                desc: "Cliente individual",
              },
              {
                value: "JURIDICA",
                icon: Building2,
                label: "Persona Jurídica",
                desc: "Empresa o entidad legal",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setTipoPersona(opt.value)
                setErrors({})
                // Persona Jurídica requiere al menos un Beneficiario Final
                // (Ley 254/2021). Sembramos una fila vacía al elegirla.
                if (opt.value === "JURIDICA" && beneficiarios.length === 0) {
                  setBeneficiarios([emptyBeneficiario()])
                }
              }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-5 text-left transition-all",
                tipoPersona === opt.value
                  ? "border-[#c9a84c] ring-2 ring-[rgba(201,168,76,0.20)]"
                  : "border-[#1b2e4a] hover:border-[#2a4060]",
              )}
              style={{
                backgroundColor:
                  tipoPersona === opt.value
                    ? "rgba(201,168,76,0.07)"
                    : "#0a1628",
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  backgroundColor:
                    tipoPersona === opt.value
                      ? "rgba(201,168,76,0.15)"
                      : "#0f1f3a",
                }}
              >
                <opt.icon
                  size={22}
                  style={{
                    color: tipoPersona === opt.value ? "#c9a84c" : "#4a6080",
                  }}
                />
              </div>
              <div className="text-center">
                <p
                  className="text-sm font-semibold"
                  style={{
                    color: tipoPersona === opt.value ? "#c9a84c" : "#f0ede8",
                  }}
                >
                  {opt.label}
                </p>
                <p className="text-xs" style={{ color: "#4a6080" }}>
                  {opt.desc}
                </p>
              </div>
            </button>
          ))}
        </div>
        {errors.tipoPersona && (
          <p className="mt-2 text-xs" style={{ color: "#e05252" }}>
            {errors.tipoPersona}
          </p>
        )}
      </div>

      {/* ── Persona Natural ── */}
      {tipoPersona === "NATURAL" && (
        <div
          className="space-y-4 border-t pt-6"
          style={{ borderColor: "#1b2e4a" }}
        >
          <SectionHeader
            icon={User}
            title="Datos de identificación"
            subtitle="Persona Natural — Ley 23/2015 Art. 19"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de identificación" required>
              <StyledSelect
                value={tipoIdNatural}
                onChange={(e) => {
                  const v = e.target.value as "CEDULA_PA" | "PASAPORTE"
                  setTipoIdNatural(v)
                  setNumIdNatural("")
                  if (v === "CEDULA_PA") setNacionalidad("Panamá")
                }}
              >
                <option value="CEDULA_PA">Cédula Panameña</option>
                <option value="PASAPORTE">Pasaporte</option>
              </StyledSelect>
            </Field>
            <Field
              label="Número de identificación"
              required
              error={errors.numIdNatural}
              hint={
                tipoIdNatural === "CEDULA_PA"
                  ? "Formato: 8-123-4567"
                  : "Número de pasaporte"
              }
            >
              <StyledInput
                value={numIdNatural}
                onChange={(e) => setNumIdNatural(e.target.value)}
                placeholder={
                  tipoIdNatural === "CEDULA_PA" ? "8-123-4567" : "A1234567"
                }
                error={errors.numIdNatural}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre(s)" required error={errors.nombres}>
              <StyledInput
                value={nombres}
                onChange={(e) => setNombres(e.target.value)}
                placeholder="Juan Carlos"
                error={errors.nombres}
              />
            </Field>
            <Field label="Apellidos" required error={errors.apellidos}>
              <StyledInput
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                placeholder="González Pérez"
                error={errors.apellidos}
              />
            </Field>
          </div>

          <Field
            label="Fecha de nacimiento"
            required
            error={errors.fechaNacimiento}
            hint="Debe ser mayor de 18 años (Ley 23/2015 Art. 18)"
          >
            <StyledInput
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              max={maxFechaNac()}
              error={errors.fechaNacimiento}
            />
          </Field>
        </div>
      )}

      {/* ── Persona Jurídica ── */}
      {tipoPersona === "JURIDICA" && (
        <div
          className="space-y-4 border-t pt-6"
          style={{ borderColor: "#1b2e4a" }}
        >
          <SectionHeader
            icon={Building2}
            title="Datos de la empresa"
            subtitle="Persona Jurídica — Ley 254/2021"
          />

          <Field label="Razón social" required error={errors.razonSocial}>
            <StyledInput
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Corp Panama S.A."
              error={errors.razonSocial}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="RUC"
              required
              error={errors.ruc}
              hint="Registro Único del Contribuyente"
            >
              <StyledInput
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="123-456-789"
                error={errors.ruc}
              />
            </Field>
            <Field
              label="Fecha de constitución"
              required
              error={errors.fechaConstitucion}
            >
              <StyledInput
                type="date"
                value={fechaConstitucion}
                onChange={(e) => setFechaConstitucion(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                error={errors.fechaConstitucion}
              />
            </Field>
          </div>
        </div>
      )}
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 2 — Información adicional
  // ──────────────────────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-5">
      {tipoPersona === "NATURAL" ? (
        <>
          <SectionHeader
            icon={User}
            title="Información adicional"
            subtitle="Persona Natural — Ley 23/2015 Art. 18-20"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Nacionalidad"
              required
              hint={tipoIdNatural === "CEDULA_PA" ? "La cédula panameña requiere nacionalidad panameña" : undefined}
            >
              <StyledSelect
                value={nacionalidad}
                disabled={tipoIdNatural === "CEDULA_PA"}
                onChange={(e) => {
                  setNacionalidad(e.target.value)
                  if (e.target.value !== "Panamá" && tipoIdNatural === "CEDULA_PA") {
                    setTipoIdNatural("PASAPORTE")
                    setNumIdNatural("")
                  }
                }}
              >
                {PAISES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </StyledSelect>
            </Field>
            <Field label="País de residencia" required>
              <StyledSelect
                value={paisResidencia}
                onChange={(e) => setPaisResidencia(e.target.value)}
              >
                {PAISES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </StyledSelect>
            </Field>
          </div>

          <Field label="Correo electrónico" required error={errors.correo}>
            <StyledInput
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="cliente@correo.com"
              error={errors.correo}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Teléfono"
              required
              error={errors.telefono}
              hint="Formato: +507-XXXX-XXXX"
            >
              <StyledInput
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+507-6000-0000"
                error={errors.telefono}
              />
            </Field>
            <Field
              label="Ocupación / Profesión"
              required
              error={errors.ocupacion}
            >
              <StyledInput
                value={ocupacion}
                onChange={(e) => setOcupacion(e.target.value)}
                placeholder="Abogado, Comerciante…"
                error={errors.ocupacion}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Ingreso mensual aproximado (USD)"
              required
              error={errors.ingresoMensual}
              hint="Monto en dólares americanos"
            >
              <StyledInput
                type="number"
                min="0"
                step="100"
                value={ingresoMensual}
                onChange={(e) => setIngresoMensual(e.target.value)}
                placeholder="0"
                error={errors.ingresoMensual}
              />
            </Field>
            <Field
              label="Fuente de ingresos"
              required
              error={errors.fuenteIngresos}
            >
              <StyledSelect
                value={fuenteIngresos}
                onChange={(e) => setFuenteIngresos(e.target.value)}
                error={errors.fuenteIngresos}
              >
                <option value="">Selecciona una fuente</option>
                <option value="EMPLEO">Empleo / Salario</option>
                <option value="NEGOCIO_PROPIO">Negocio propio</option>
                <option value="INVERSIONES">Inversiones</option>
                <option value="BIENES_RAICES">Bienes raíces / Alquileres</option>
                <option value="PENSION">Pensión / Jubilación</option>
                <option value="REMESAS">Remesas</option>
                <option value="HERENCIA">Herencia / Donación</option>
                <option value="OTRO">Otro</option>
              </StyledSelect>
            </Field>
          </div>

          {/* PEP */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: esPep ? "rgba(224,82,82,0.06)" : "#0a1628",
              border: `1px solid ${esPep ? "rgba(224,82,82,0.30)" : "#1b2e4a"}`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldAlert
                  size={18}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: esPep ? "#e05252" : "#4a6080" }}
                />
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: esPep ? "#e05252" : "#f0ede8" }}
                  >
                    Persona Expuesta Políticamente (PEP)
                  </p>
                  <p
                    className="mt-0.5 text-xs leading-relaxed"
                    style={{ color: "#8a9bb5" }}
                  >
                    Desempeña o ha desempeñado funciones públicas prominentes.
                    Activa DDR obligatoria —{" "}
                    <span style={{ color: "#c9a84c" }}>
                      Ley 23/2015 Art. 24
                    </span>
                  </p>
                </div>
              </div>
              <Toggle
                checked={esPep}
                onChange={() => setEsPep((p) => !p)}
                danger
              />
            </div>
            {esPep && (
              <div
                className="mt-3 rounded-lg p-3"
                style={{ backgroundColor: "rgba(224,82,82,0.08)" }}
              >
                <p className="text-xs" style={{ color: "#e05252" }}>
                  ⚠ Este cliente requiere completar Debida Diligencia Reforzada
                  (DDR) antes de ser activado.
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <SectionHeader
            icon={Building2}
            title="Información adicional"
            subtitle="Persona Jurídica — Ley 254/2021"
          />

          <div className="grid grid-cols-2 gap-4">
            <Field label="País de constitución" required>
              <StyledSelect
                value={paisConstitucion}
                onChange={(e) => setPaisConstitucion(e.target.value)}
              >
                {PAISES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </StyledSelect>
            </Field>
            <Field
              label="Actividad económica (CIIU)"
              required
              error={errors.actividadEconomica}
            >
              <StyledSelect
                value={actividadEconomica}
                onChange={(e) => setActividadEconomica(e.target.value)}
                error={errors.actividadEconomica}
              >
                <option value="">Selecciona una actividad</option>
                {ACTIVIDADES_CIIU.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </StyledSelect>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Tipo de sociedad"
              required
            >
              <StyledSelect
                value={tipoSociedad}
                onChange={(e) => setTipoSociedad(e.target.value)}
              >
                <option value="SOCIEDAD_ANONIMA">Sociedad Anónima (S.A.)</option>
                <option value="SOCIEDAD_RESPONSABILIDAD_LIMITADA">
                  Sociedad de Responsabilidad Limitada (S.R.L.)
                </option>
                <option value="SOCIEDAD_COLECTIVA">Sociedad Colectiva</option>
                <option value="SOCIEDAD_EN_COMANDITA">Sociedad en Comandita</option>
                <option value="FUNDACION">Fundación</option>
                <option value="ASOCIACION">Asociación sin fines de lucro</option>
                <option value="OTRO">Otro</option>
              </StyledSelect>
            </Field>
            <Field
              label="N° Registro Mercantil"
              required
              error={errors.numeroRegistroMercantil}
            >
              <StyledInput
                value={numeroRegistroMercantil}
                onChange={(e) => setNumeroRegistroMercantil(e.target.value)}
                placeholder="RM-1234567"
                error={errors.numeroRegistroMercantil}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Dirección fiscal"
              required
              error={errors.direccionFiscal}
            >
              <StyledInput
                value={direccionFiscal}
                onChange={(e) => setDireccionFiscal(e.target.value)}
                placeholder="Av. Principal 123, Edif. ABC, Piso 5"
                error={errors.direccionFiscal}
              />
            </Field>
            <Field label="Ciudad" required error={errors.ciudadEmpresa}>
              <StyledInput
                value={ciudadEmpresa}
                onChange={(e) => setCiudadEmpresa(e.target.value)}
                placeholder="Ciudad de Panamá"
                error={errors.ciudadEmpresa}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Teléfono de la empresa"
              required
              error={errors.telefonoEmpresa}
              hint="Formato: +507-XXXX-XXXX"
            >
              <StyledInput
                value={telefonoEmpresa}
                onChange={(e) => setTelefonoEmpresa(e.target.value)}
                placeholder="+507-200-0000"
                error={errors.telefonoEmpresa}
              />
            </Field>
            <Field
              label="Correo de la empresa"
              required
              error={errors.emailEmpresa}
            >
              <StyledInput
                type="email"
                value={emailEmpresa}
                onChange={(e) => setEmailEmpresa(e.target.value)}
                placeholder="contacto@empresa.com"
                error={errors.emailEmpresa}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Representante legal"
              required
              error={errors.representanteLegal}
            >
              <StyledInput
                value={representanteLegal}
                onChange={(e) => setRepresentanteLegal(e.target.value)}
                placeholder="Nombre completo"
                error={errors.representanteLegal}
              />
            </Field>
            <Field
              label="Identificación del representante"
              required
              error={errors.idRepresentante}
              hint="Cédula o pasaporte"
            >
              <StyledInput
                value={idRepresentante}
                onChange={(e) => setIdRepresentante(e.target.value)}
                placeholder="8-123-4567"
                error={errors.idRepresentante}
              />
            </Field>
          </div>

          <Field label="Cargo del representante" required>
            <StyledSelect
              value={cargoRepresentante}
              onChange={(e) => setCargoRepresentante(e.target.value)}
            >
              <option value="REPRESENTANTE_LEGAL">Representante Legal</option>
              <option value="PRESIDENTE">Presidente</option>
              <option value="GERENTE_GENERAL">Gerente General</option>
              <option value="DIRECTOR">Director</option>
              <option value="APODERADO">Apoderado</option>
              <option value="OTRO">Otro</option>
            </StyledSelect>
          </Field>

          {/* Beneficiarios Finales — OBLIGATORIO para Persona Jurídica */}
          <div
            className="rounded-xl p-4"
            style={{
              backgroundColor: "rgba(201,168,76,0.06)",
              border: "1px solid rgba(201,168,76,0.30)",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: "#f0ede8" }}>
                  Beneficiarios Finales{" "}
                  <span style={{ color: "#e05252" }}>*</span>
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "#8a9bb5" }}>
                  Personas naturales con participación directa o indirecta. La
                  suma debe ser{" "}
                  <strong style={{ color: "#c9a84c" }}>exactamente 100%</strong>{" "}
                  — <span style={{ color: "#c9a84c" }}>Ley 254/2021 Art. 3</span>
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {errors.beneficiarios && (
                <p className="text-xs" style={{ color: "#e05252" }}>
                  {errors.beneficiarios}
                </p>
              )}
              {errors.totalPct && (
                <div
                  className="rounded-lg p-3"
                  style={{
                    backgroundColor: "rgba(224,82,82,0.08)",
                    border: "1px solid rgba(224,82,82,0.25)",
                  }}
                >
                  <p className="text-xs" style={{ color: "#e05252" }}>
                    {errors.totalPct}
                  </p>
                </div>
              )}

              {beneficiarios.map((bf, i) => (
                <div
                  key={bf.id}
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: "#040d1c",
                    border: "1px solid #1b2e4a",
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p
                      className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#c9a84c" }}
                    >
                      Beneficiario Final #{i + 1}
                    </p>
                    {beneficiarios.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBeneficiario(bf.id)}
                        className="rounded p-1 transition-colors hover:text-[#e05252]"
                        style={{ color: "#4a6080" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Nombre"
                        required
                        error={errors[`bf_${i}_nombre`]}
                      >
                        <StyledInput
                          value={bf.nombre}
                          onChange={(e) =>
                            updateBF(bf.id, "nombre", e.target.value)
                          }
                          placeholder="Juan Carlos"
                          error={errors[`bf_${i}_nombre`]}
                        />
                      </Field>
                      <Field
                        label="Apellido"
                        required
                        error={errors[`bf_${i}_apellido`]}
                      >
                        <StyledInput
                          value={bf.apellido}
                          onChange={(e) =>
                            updateBF(bf.id, "apellido", e.target.value)
                          }
                          placeholder="González Pérez"
                          error={errors[`bf_${i}_apellido`]}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tipo identificación" required>
                        <StyledSelect
                          value={bf.tipo_identificacion}
                          onChange={(e) =>
                            updateBF(
                              bf.id,
                              "tipo_identificacion",
                              e.target.value,
                            )
                          }
                        >
                          <option value="CEDULA_PA">Cédula PA</option>
                          <option value="PASAPORTE">Pasaporte</option>
                        </StyledSelect>
                      </Field>
                      <Field
                        label="Número"
                        required
                        error={errors[`bf_${i}_id`]}
                      >
                        <StyledInput
                          value={bf.numero_identificacion}
                          onChange={(e) =>
                            updateBF(
                              bf.id,
                              "numero_identificacion",
                              e.target.value,
                            )
                          }
                          placeholder="8-123-4567"
                          error={errors[`bf_${i}_id`]}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Fecha de nacimiento"
                        required
                        error={errors[`bf_${i}_nac`]}
                        hint="Debe ser mayor de 18 años"
                      >
                        <StyledInput
                          type="date"
                          value={bf.fecha_nacimiento}
                          onChange={(e) =>
                            updateBF(
                              bf.id,
                              "fecha_nacimiento",
                              e.target.value,
                            )
                          }
                          max={maxFechaNac()}
                          error={errors[`bf_${i}_nac`]}
                        />
                      </Field>
                      <Field
                        label="% Participación"
                        required
                        error={errors[`bf_${i}_pct`]}
                      >
                        <StyledInput
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={bf.porcentaje_participacion}
                          onChange={(e) =>
                            updateBF(
                              bf.id,
                              "porcentaje_participacion",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                          error={errors[`bf_${i}_pct`]}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Tipo control" required>
                        <StyledSelect
                          value={bf.tipo_control}
                          onChange={(e) =>
                            updateBF(bf.id, "tipo_control", e.target.value)
                          }
                        >
                          <option value="DIRECTA">Directa</option>
                          <option value="INDIRECTA">Indirecta</option>
                          <option value="OTRO">Otro</option>
                        </StyledSelect>
                      </Field>
                      <Field label="País residencia" required>
                        <StyledSelect
                          value={bf.pais_residencia}
                          onChange={(e) =>
                            updateBF(bf.id, "pais_residencia", e.target.value)
                          }
                        >
                          {PAISES.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </StyledSelect>
                      </Field>
                    </div>

                    <div className="flex items-center gap-3">
                      <Toggle
                        checked={bf.es_pep}
                        onChange={() => updateBF(bf.id, "es_pep", !bf.es_pep)}
                        danger
                      />
                      <span
                        className="text-xs"
                        style={{ color: bf.es_pep ? "#e05252" : "#8a9bb5" }}
                      >
                        Es Persona Expuesta Políticamente (PEP)
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Totalizador con regla de color */}
              {beneficiarios.length > 0 && (
                <div
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{
                    backgroundColor: "#040d1c",
                    border: `1px solid ${
                      totalPorcentajeBF > 100
                        ? "rgba(224,82,82,0.40)"
                        : totalPorcentajeBF === 100
                          ? "rgba(34,197,94,0.40)"
                          : "rgba(217,119,6,0.40)"
                    }`,
                  }}
                  aria-live="polite"
                >
                  <div>
                    <span className="text-xs" style={{ color: "#8a9bb5" }}>
                      Total participación
                    </span>
                    <p className="mt-0.5 text-[10px]" style={{ color: "#4a6080" }}>
                      Debe sumar exactamente 100% (Ley 254/2021)
                    </p>
                  </div>
                  <span
                    className="text-base font-bold font-mono"
                    style={{
                      color:
                        totalPorcentajeBF > 100
                          ? "#e05252"
                          : totalPorcentajeBF === 100
                            ? "#22c55e"
                            : "#d97706",
                    }}
                  >
                    {totalPorcentajeBF.toFixed(2)}%
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={addBeneficiario}
                className="flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-sm transition-all hover:border-[#c9a84c] hover:text-[#c9a84c]"
                style={{
                  borderColor: "#1b2e4a",
                  borderStyle: "dashed",
                  color: "#8a9bb5",
                }}
              >
                <Plus size={15} />
                Agregar Beneficiario Final
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 3 — Documentos
  // ──────────────────────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="space-y-5">
      <SectionHeader
        icon={FileText}
        title="Carga de documentos"
        subtitle="PDF, JPG o PNG — Máx. 10 MB por archivo — Ley 23/2015 Art. 20"
      />

      <div
        className="flex items-start gap-2.5 rounded-xl p-4"
        style={{
          backgroundColor: "rgba(201,168,76,0.06)",
          border: "1px solid rgba(201,168,76,0.20)",
        }}
      >
        <Info
          size={14}
          className="mt-0.5 flex-shrink-0"
          style={{ color: "#c9a84c" }}
        />
        <p className="text-xs leading-relaxed" style={{ color: "#8a9bb5" }}>
          Los documentos deben estar{" "}
          <strong style={{ color: "#f0ede8" }}>vigentes</strong>. El comprobante
          de domicilio no puede tener más de{" "}
          <strong style={{ color: "#f0ede8" }}>90 días</strong> de antigüedad —
          RV-07.
        </p>
      </div>

      <DropZone
        label="Documento de identidad"
        hint="Cédula, pasaporte o RUC vigente"
        file={docIdentidad}
        onFile={setDocIdentidad}
        required
        error={errors.docIdentidad}
      />

      {tipoPersona === "NATURAL" && (
        <DropZone
          label="Comprobante de domicilio"
          hint="Factura de servicios (máx. 90 días de antigüedad)"
          file={docDomicilio}
          onFile={setDocDomicilio}
          required
          error={errors.docDomicilio}
        />
      )}

      {tipoPersona === "JURIDICA" && (
        <>
          <DropZone
            label="Escritura de constitución"
            hint="Documento de constitución de la empresa"
            file={docConstitucion}
            onFile={setDocConstitucion}
            required
            error={errors.docConstitucion}
          />
          <DropZone
            label="Poder del representante legal"
            hint="Acredita la representación (opcional)"
            file={docPoder}
            onFile={setDocPoder}
            error={errors.docPoder}
          />
        </>
      )}
    </div>
  )

  // ──────────────────────────────────────────────────────────────────────────
  // PASO 4 — Revisión y confirmación
  // ──────────────────────────────────────────────────────────────────────────
  const renderStep4 = () => {
    const Row = ({
      label,
      value,
    }: {
      label: string
      value: React.ReactNode
    }) => (
      <div
        className="flex items-start justify-between gap-4 py-2.5"
        style={{ borderBottom: "1px solid #0f1f3a" }}
      >
        <span className="flex-shrink-0 text-sm" style={{ color: "#8a9bb5" }}>
          {label}
        </span>
        <span
          className="text-right text-sm font-medium"
          style={{ color: "#f0ede8" }}
        >
          {value}
        </span>
      </div>
    )

    const docsCargados = [
      { label: "Documento de identidad", file: docIdentidad },
      { label: "Comprobante de domicilio", file: docDomicilio },
      { label: "Escritura de constitución", file: docConstitucion },
      { label: "Poder del representante", file: docPoder },
    ].filter((d) => d.file)

    return (
      <div className="space-y-5">
        <SectionHeader
          icon={CheckCircle}
          title="Revisión y confirmación"
          subtitle="Verifica los datos antes de enviar el expediente"
        />

        {/* Nivel de riesgo */}
        <div
          className="flex items-center justify-between rounded-xl p-4"
          style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "#f0ede8" }}>
              Nivel de riesgo calculado
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "#4a6080" }}>
              Motor EBR — Ley 23/2015 Art. 22
            </p>
          </div>
          <RiskBadge nivel={nivelRiesgo} />
        </div>

        {/* Alerta DDR */}
        {(esPep || beneficiarios.some((b) => b.es_pep)) && (
          <div
            className="flex items-start gap-3 rounded-xl p-4"
            style={{
              backgroundColor: "rgba(224,82,82,0.08)",
              border: "1px solid rgba(224,82,82,0.25)",
            }}
          >
            <AlertTriangle
              size={16}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "#e05252" }}
            />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e05252" }}>
                DDR Obligatoria activada
              </p>
              <p className="mt-0.5 text-xs" style={{ color: "#8a9bb5" }}>
                Este expediente activará el flujo de Debida Diligencia Reforzada
                al ser creado — Ley 23/2015 Art. 26.
              </p>
            </div>
          </div>
        )}

        {/* Resumen datos */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#4a6080" }}
          >
            {tipoPersona === "NATURAL" ? "Persona Natural" : "Persona Jurídica"}
          </p>

          {tipoPersona === "NATURAL" ? (
            <>
              <Row label="Nombre completo" value={`${nombres} ${apellidos}`} />
              <Row
                label="Identificación"
                value={`${tipoIdNatural === "CEDULA_PA" ? "Cédula PA" : "Pasaporte"}: ${numIdNatural}`}
              />
              <Row label="Fecha de nacimiento" value={fechaNacimiento} />
              <Row label="Nacionalidad" value={nacionalidad} />
              <Row label="País de residencia" value={paisResidencia} />
              <Row label="Correo electrónico" value={correo} />
              <Row label="Teléfono" value={telefono} />
              <Row label="Ocupación" value={ocupacion} />
              <Row
                label="Ingreso mensual"
                value={ingresoMensual ? `$${parseFloat(ingresoMensual).toLocaleString()} USD` : "—"}
              />
              <Row label="Fuente de ingresos" value={fuenteIngresos || "—"} />
              <Row
                label="PEP"
                value={
                  esPep ? (
                    <span style={{ color: "#e05252" }}>Sí — DDR requerida</span>
                  ) : (
                    "No"
                  )
                }
              />
            </>
          ) : (
            <>
              <Row label="Razón social" value={razonSocial} />
              <Row label="RUC" value={ruc} />
              <Row label="Fecha constitución" value={fechaConstitucion} />
              <Row label="País constitución" value={paisConstitucion} />
              <Row label="Actividad económica" value={actividadEconomica} />
              <Row label="Representante legal" value={representanteLegal} />
              <Row label="ID Representante" value={idRepresentante} />
              <Row
                label="Beneficiarios finales"
                value={
                  <span
                    style={{
                      color:
                        Math.round(totalPorcentajeBF) === 100
                          ? "#22c55e"
                          : "#e05252",
                    }}
                  >
                    {beneficiarios.length} registrado(s) ·{" "}
                    {totalPorcentajeBF.toFixed(0)}% total
                  </span>
                }
              />
            </>
          )}
        </div>

        {/* Documentos */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#4a6080" }}
          >
            Documentos cargados ({docsCargados.length})
          </p>
          {docsCargados.map((d) => (
            <div
              key={d.label}
              className="flex items-center gap-2 py-2"
              style={{ borderBottom: "1px solid #0f1f3a" }}
            >
              <CheckCircle size={13} style={{ color: "#22c55e" }} />
              <span className="text-sm" style={{ color: "#f0ede8" }}>
                {d.label}
              </span>
              <span
                className="ml-auto truncate text-xs font-mono"
                style={{ color: "#4a6080" }}
              >
                {d.file?.name}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs leading-relaxed" style={{ color: "#4a6080" }}>
          Al confirmar, el expediente quedará en estado{" "}
          <strong style={{ color: "#c9a84c" }}>Pendiente de Revisión</strong> y
          se notificará al Oficial de Cumplimiento. Ref. Ley 23/2015 Art. 18.
        </p>
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="mb-1 text-[26px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Nuevo Cliente KYC
        </h1>
        <p className="text-sm" style={{ color: "#8a9bb5" }}>
          Registro digital de cliente · Módulo KYC · Ley 23/2015 Art. 18-25
        </p>
      </div>

      <StepIndicator current={step} />

      {/* Card */}
      <div
        className="rounded-2xl p-7"
        style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}

        {/* Navigation */}
        <div
          className="mt-8 flex items-center justify-between border-t pt-6"
          style={{ borderColor: "#1b2e4a" }}
        >
          <button
            type="button"
            onClick={step === 1 ? () => navigate({ to: "/" }) : handleBack}
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm transition-all hover:text-[#c9a84c]"
            style={{ color: "#8a9bb5" }}
          >
            <ChevronLeft size={16} />
            {step === 1 ? "Cancelar" : "Anterior"}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className={cn(
                "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all",
                "hover:brightness-110 active:scale-[0.99]",
              )}
              style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
            >
              Siguiente
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                (tipoPersona === "JURIDICA" &&
                  Math.round(totalPorcentajeBF) !== 100)
              }
              title={
                tipoPersona === "JURIDICA" &&
                Math.round(totalPorcentajeBF) !== 100
                  ? `Los beneficiarios deben sumar 100% (actual: ${totalPorcentajeBF.toFixed(0)}%)`
                  : undefined
              }
              className={cn(
                "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all",
                "hover:brightness-110 active:scale-[0.99]",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
              style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Guardando…
                </>
              ) : (
                "Guardar y Enviar a Revisión"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
