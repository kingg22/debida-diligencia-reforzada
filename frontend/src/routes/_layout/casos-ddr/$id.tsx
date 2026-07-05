import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardCheck,
  CornerUpLeft,
  FileText,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UsersService } from "@/client"
import { CasosDdrService, SgddrApiError } from "@/client/sgddr"
import { EstadoCasoBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { ErrorState, LoadingState } from "@/components/Common/QueryStates"
import useAuth from "@/hooks/useAuth"
import {
  type AppUser,
  formatBytes,
  formatFecha,
  formatFechaHora,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/casos-ddr/$id")({
  component: CasoDetallePage,
  head: () => ({
    meta: [{ title: "Detalle de caso DDR — PanamaCompliance SGDDR" }],
  }),
})

// ─── Cadena de revisión (cuatro ojos) ────────────────────────────────────────
// Cada etapa lleva el ROL responsable: es la representación visual del
// principio de segregación de funciones. Quien registra no investiga;
// quien investiga no valida; quien valida no decide.

const ETAPAS: Array<{ etapa: string; rol: string }> = [
  { etapa: "Asignación", rol: "Oficial" },
  { etapa: "Investigación", rol: "Analista" },
  { etapa: "Revisión", rol: "Oficial" },
  { etapa: "Aprobación", rol: "Gerente / Comité" },
  { etapa: "Resolución", rol: "—" },
]

function etapaActual(estado: string): number {
  switch (estado) {
    case "ABIERTO":
      return 0
    case "EN_REVISION":
      return 1
    case "EN_REVISION_OFICIAL":
      return 2
    case "EN_APROBACION":
      return 3
    case "APROBADO":
    case "RECHAZADO":
      return 4
    default:
      return 0
  }
}

function CadenaRevision({
  current,
  nivel,
  rechazado,
}: {
  current: number
  nivel: string
  rechazado: boolean
}) {
  return (
    <div className="flex items-start">
      {ETAPAS.map((s, i) => {
        const done = i < current || (i === current && current === 4)
        const active = i === current && current < 4
        const esFinal = i === 4
        const color =
          esFinal && current === 4
            ? rechazado
              ? "#e05252"
              : "#22c55e"
            : done
              ? "#22c55e"
              : active
                ? "#c9a84c"
                : "#4a6080"
        return (
          <div key={s.etapa} className="flex flex-1 items-start">
            <div className="flex min-w-0 flex-col items-center">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor:
                    done || (esFinal && current === 4)
                      ? color
                      : active
                        ? "#c9a84c"
                        : "#0a1628",
                  color:
                    done || active || (esFinal && current === 4)
                      ? "#040d1c"
                      : "#4a6080",
                  border:
                    done || active || (esFinal && current === 4)
                      ? "none"
                      : "1px solid #1b2e4a",
                  boxShadow: active
                    ? "0 0 0 3px rgba(201,168,76,0.20)"
                    : "none",
                }}
              >
                {done || (esFinal && current === 4) ? (
                  <Check size={14} />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className="mt-1.5 whitespace-nowrap text-xs font-medium"
                style={{ color: active ? "#c9a84c" : done ? "#22c55e" : "#4a6080" }}
              >
                {s.etapa}
              </span>
              <span
                className="mt-0.5 whitespace-nowrap text-[10px] uppercase tracking-wide"
                style={{ color: "#4a6080" }}
              >
                {s.rol === "Gerente / Comité"
                  ? nivel === "MUY_ALTO"
                    ? "Comité"
                    : "Gerente"
                  : s.rol}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div
                className="mx-2 mt-4 h-px flex-1"
                style={{
                  backgroundColor: i < current ? "#22c55e" : "#1b2e4a",
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── UI atoms ────────────────────────────────────────────────────────────────

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "#4a6080" }}
        >
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  )
}

const ETIQUETAS: Record<string, string> = {
  MASCULINO: "Masculino",
  FEMENINO: "Femenino",
  OTRO: "Otro",
  SOLTERO: "Soltero/a",
  CASADO: "Casado/a",
  DIVORCIADO: "Divorciado/a",
  VIUDO: "Viudo/a",
  UNION_LIBRE: "Unión libre",
  CEDULA_PA: "Cédula Panameña",
  PASAPORTE: "Pasaporte",
  EMPLEO: "Empleo / Salario",
  NEGOCIO_PROPIO: "Negocio propio",
  INVERSIONES: "Inversiones",
  BIENES_RAICES: "Bienes raíces / Alquileres",
  PENSION: "Pensión / Jubilación",
  REMESAS: "Remesas",
  HERENCIA: "Herencia / Donación",
  SOCIEDAD_ANONIMA: "Sociedad Anónima (S.A.)",
  SOCIEDAD_RESPONSABILIDAD_LIMITADA: "S.R.L.",
  MENOS_100K: "Menos de $100k",
  "100K_500K": "$100k – $500k",
  "500K_1M": "$500k – $1M",
  MAS_1M: "Más de $1M",
}

function etiqueta(v?: string | null): string {
  if (!v) return "—"
  return ETIQUETAS[v] ?? v
}

function Dato({
  label,
  value,
  alerta,
}: {
  label: string
  value: React.ReactNode
  alerta?: boolean
}) {
  return (
    <div>
      <p className="text-xs" style={{ color: "#4a6080" }}>
        {label}
      </p>
      <p
        className="mt-0.5 text-sm"
        style={{ color: alerta ? "#e05252" : "#f0ede8" }}
      >
        {value}
      </p>
    </div>
  )
}

function FlagRiesgo({ activo, label }: { activo: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: activo ? "rgba(224,82,82,0.12)" : "rgba(34,197,94,0.10)",
        color: activo ? "#e05252" : "#22c55e",
      }}
    >
      {activo ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
      {label}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

function CasoDetallePage() {
  const { id } = useParams({ from: "/_layout/casos-ddr/$id" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const rol = (user as AppUser | null | undefined)?.role
  const userId = (user as AppUser | null | undefined)?.id

  const [analistaSel, setAnalistaSel] = useState("")
  const [rechazoOpen, setRechazoOpen] = useState(false)
  const [devolverOpen, setDevolverOpen] = useState(false)
  const [observaciones, setObservaciones] = useState("")

  const {
    data: caso,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["caso-ddr", id],
    queryFn: () => CasosDdrService.get(id),
    retry: false,
    enabled: !!id,
  })

  const cliente = caso?.cliente

  // Expediente KYC completo: el revisor (Oficial/Gerente/Comité/Auditor)
  // necesita el dossier íntegro del cliente para decidir con fundamento.
  const { data: expediente } = useQuery({
    queryKey: ["caso-ddr", id, "expediente"],
    queryFn: () => CasosDdrService.expediente(id),
    retry: false,
    enabled: !!id,
  })

  const { data: cuestionario } = useQuery({
    queryKey: ["caso-ddr", id, "cuestionario"],
    queryFn: () => CasosDdrService.cuestionario(id),
    retry: false,
    enabled: !!id,
  })

  const { data: documentosDdr } = useQuery({
    queryKey: ["caso-ddr", id, "documentos"],
    queryFn: () => CasosDdrService.listarDocumentos(id),
    retry: false,
    enabled: !!id,
  })

  // Analistas para el select de asignación (solo lo usa el Oficial).
  const { data: usuarios } = useQuery({
    queryKey: ["analistas"],
    queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
    enabled: rol === "OFICIAL_CUMPLIMIENTO" || rol === "ADMIN",
    retry: false,
  })
  // Cuatro ojos: quien registró el expediente no puede investigarlo.
  const analistas = ((usuarios?.data ?? []) as AppUser[]).filter(
    (u) => u.role === "ANALISTA_DDR" && u.id !== expediente?.analista_id,
  )

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["caso-ddr", id] })
    queryClient.invalidateQueries({
      queryKey: ["caso-ddr", id, "cuestionario"],
    })
    queryClient.invalidateQueries({ queryKey: ["caso-ddr", id, "documentos"] })
  }

  const onError = (e: Error) => {
    const msg = e instanceof SgddrApiError ? e.detail : e.message
    toast.error(msg || "No se pudo completar la acción")
  }

  const asignar = useMutation({
    mutationFn: () => CasosDdrService.asignar(id, analistaSel),
    onSuccess: () => {
      toast.success("Analista asignado. El caso pasa a investigación.")
      invalidar()
    },
    onError,
  })

  const validar = useMutation({
    mutationFn: () => CasosDdrService.validar(id),
    onSuccess: () => {
      toast.success("Caso validado y escalado a aprobación.")
      invalidar()
    },
    onError,
  })

  const devolver = useMutation({
    mutationFn: () => CasosDdrService.devolver(id, { observaciones }),
    onSuccess: () => {
      toast.success("Caso devuelto al analista con observaciones.")
      setDevolverOpen(false)
      setObservaciones("")
      invalidar()
    },
    onError,
  })

  const aprobar = useMutation({
    mutationFn: () => CasosDdrService.aprobar(id),
    onSuccess: () => {
      toast.success("Caso aprobado.")
      invalidar()
    },
    onError,
  })

  const rechazar = useMutation({
    mutationFn: () => CasosDdrService.rechazar(id, { observaciones }),
    onSuccess: () => {
      toast.success("Caso rechazado.")
      setRechazoOpen(false)
      setObservaciones("")
      invalidar()
    },
    onError,
  })

  const esOficial = rol === "OFICIAL_CUMPLIMIENTO" || rol === "ADMIN"
  const pn = expediente?.persona_natural
  const pj = expediente?.persona_juridica

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate({ to: "/casos-ddr" })}
        className="flex items-center gap-1.5 text-sm transition-colors hover:text-[#c9a84c]"
        style={{ color: "#8a9bb5" }}
      >
        <ArrowLeft size={15} /> Volver a casos DDR
      </button>

      {isPending ? (
        <LoadingState label="Cargando caso…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : caso ? (
        <>
          <PageHeader
            title={
              cliente
                ? `${cliente.nombres} ${cliente.apellidos}`.trim() || "Caso DDR"
                : "Caso DDR"
            }
            subtitle={
              cliente
                ? `${cliente.numero_identificacion} · Expediente ${cliente.codigo}`
                : `Caso #${caso.id.slice(0, 8)}`
            }
            action={
              <div className="flex items-center gap-2">
                <NivelRiesgoBadge nivel={caso.nivel_riesgo} />
                <EstadoCasoBadge estado={caso.status} />
              </div>
            }
          />

          {/* Cadena de revisión (cuatro ojos) */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
          >
            <CadenaRevision
              current={etapaActual(caso.status)}
              nivel={caso.nivel_riesgo}
              rechazado={caso.status === "RECHAZADO"}
            />
          </div>

          {/* Observaciones del Oficial al devolver (visible al analista) */}
          {caso.status === "EN_REVISION" && caso.observaciones_oficial && (
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{
                backgroundColor: "rgba(201,168,76,0.07)",
                border: "1px solid rgba(201,168,76,0.30)",
              }}
            >
              <CornerUpLeft
                size={16}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "#c9a84c" }}
              />
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#c9a84c" }}
                >
                  Devuelto por el Oficial de Cumplimiento
                </p>
                <p className="mt-1 text-sm" style={{ color: "#f0ede8" }}>
                  {caso.observaciones_oficial}
                </p>
              </div>
            </div>
          )}

          {/* Motivo del rechazo */}
          {caso.status === "RECHAZADO" && caso.observaciones_rechazo && (
            <div
              className="rounded-xl p-4"
              style={{
                backgroundColor: "rgba(224,82,82,0.08)",
                border: "1px solid rgba(224,82,82,0.25)",
              }}
            >
              <p
                className="mb-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#e05252" }}
              >
                Motivo del rechazo
              </p>
              <p className="text-sm" style={{ color: "#f0ede8" }}>
                {caso.observaciones_rechazo}
              </p>
            </div>
          )}

          <Card title="Información del caso">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Dato
                label="Fecha de apertura"
                value={formatFecha(caso.fecha_apertura)}
              />
              <Dato
                label="Cuestionario EBR"
                value={cuestionario?.completado ? "Completado" : "Pendiente"}
              />
              <Dato
                label="Documentos DDR"
                value={`${documentosDdr?.count ?? 0} cargado(s)`}
              />
              <Dato
                label="Puntaje de riesgo"
                value={
                  expediente?.puntaje_riesgo != null
                    ? `${expediente.puntaje_riesgo} pts`
                    : "—"
                }
              />
            </div>
          </Card>

          {/* Dossier del cliente: información completa para el revisor */}
          {pn && (
            <Card title="Expediente del cliente — Persona Natural">
              <div className="mb-4 flex flex-wrap gap-2">
                <FlagRiesgo activo={pn.es_pep} label="PEP" />
                <FlagRiesgo activo={pn.es_pep_familiar} label="Familiar de PEP" />
                <FlagRiesgo
                  activo={pn.tiene_antecedentes}
                  label="Antecedentes penales"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Dato
                  label="Documento"
                  value={`${etiqueta(pn.tipo_documento)} · ${pn.numero_documento}`}
                />
                <Dato
                  label="Expira"
                  value={pn.fecha_expiracion_doc || "—"}
                />
                <Dato label="Nacionalidad" value={pn.nacionalidad} />
                <Dato label="Fecha de nacimiento" value={pn.fecha_nacimiento} />
                <Dato label="Género" value={etiqueta(pn.genero)} />
                <Dato label="Estado civil" value={etiqueta(pn.estado_civil)} />
                <Dato label="Teléfono" value={pn.telefono} />
                <Dato label="Correo" value={pn.email} />
                <Dato
                  label="Residencia"
                  value={`${pn.direccion}, ${pn.ciudad}, ${pn.pais}`}
                />
                <Dato label="Ocupación" value={pn.ocupacion} />
                <Dato label="Empleador" value={pn.empleador || "—"} />
                <Dato
                  label="Ingreso mensual"
                  value={`$${(pn.ingreso_mensual_aproximado ?? 0).toLocaleString()} USD`}
                />
                <Dato
                  label="Fuente de ingresos"
                  value={etiqueta(pn.fuente_ingresos)}
                />
              </div>
            </Card>
          )}

          {pj && (
            <Card title="Expediente del cliente — Persona Jurídica">
              <div className="mb-4 flex flex-wrap gap-2">
                <FlagRiesgo
                  activo={pj.tiene_accionistas_anonimos}
                  label="Accionistas anónimos"
                />
                <FlagRiesgo
                  activo={pj.opera_en_paises_alto_riesgo}
                  label="Opera en países de alto riesgo"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Dato label="Razón social" value={pj.razon_social} />
                <Dato label="RUC" value={pj.ruc} />
                <Dato
                  label="Tipo de sociedad"
                  value={etiqueta(pj.tipo_sociedad)}
                />
                <Dato
                  label="Constitución"
                  value={`${pj.fecha_constitucion} · ${pj.pais_constitucion}`}
                />
                <Dato
                  label="Registro mercantil"
                  value={pj.numero_registro_mercantil}
                />
                <Dato
                  label="Actividad económica"
                  value={pj.actividad_economica}
                />
                <Dato
                  label="Representante"
                  value={`${pj.nombre_representante} (${pj.cedula_representante})`}
                />
                <Dato label="Teléfono" value={pj.telefono_empresa} />
                <Dato label="Correo" value={pj.email_empresa} />
                <Dato
                  label="Dirección fiscal"
                  value={`${pj.direccion_fiscal}, ${pj.ciudad}`}
                />
                <Dato
                  label="Ingreso anual"
                  value={`$${(pj.ingreso_anual_aproximado ?? 0).toLocaleString()} USD`}
                />
                <Dato
                  label="Empleados"
                  value={String(pj.cantidad_empleados ?? 0)}
                />
              </div>

              {(expediente?.beneficiarios_final?.length ?? 0) > 0 && (
                <div className="mt-5 border-t pt-4" style={{ borderColor: "#1b2e4a" }}>
                  <p
                    className="mb-3 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#4a6080" }}
                  >
                    Beneficiarios finales
                  </p>
                  <div className="space-y-2">
                    {expediente?.beneficiarios_final.map((bf) => (
                      <div
                        key={bf.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2"
                        style={{ backgroundColor: "#040d1c" }}
                      >
                        <div className="flex items-center gap-2">
                          <User size={13} style={{ color: "#4a6080" }} />
                          <span className="text-sm" style={{ color: "#f0ede8" }}>
                            {bf.nombre} {bf.apellido}
                          </span>
                          {bf.es_pep && (
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: "rgba(224,82,82,0.12)",
                                color: "#e05252",
                              }}
                            >
                              PEP
                            </span>
                          )}
                        </div>
                        <span
                          className="font-mono text-xs"
                          style={{ color: "#8a9bb5" }}
                        >
                          {bf.porcentaje_participacion}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Cuestionario EBR: las respuestas del analista, legibles para
              el Oficial y la instancia de aprobación */}
          {cuestionario?.completado && (
            <Card
              title="Cuestionario EBR — Respuestas del analista"
              action={
                <span className="text-xs" style={{ color: "#4a6080" }}>
                  Completado {formatFechaHora(cuestionario.completado_en)}
                </span>
              }
            >
              <div className="space-y-4">
                <Dato
                  label="Origen de los fondos"
                  value={cuestionario.origen_fondos || "—"}
                />
                <Dato
                  label="Propósito de la relación comercial"
                  value={cuestionario.proposito_relacion || "—"}
                />
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Dato
                    label="Patrimonio estimado"
                    value={etiqueta(cuestionario.patrimonio_estimado)}
                  />
                  <Dato
                    label="Origen del patrimonio"
                    value={cuestionario.pais_origen_patrimonio || "—"}
                  />
                  <Dato
                    label="Estructura societaria compleja"
                    value={cuestionario.tiene_estructura_societaria ? "Sí" : "No"}
                    alerta={cuestionario.tiene_estructura_societaria === true}
                  />
                  <Dato
                    label="Familiares PEP"
                    value={cuestionario.familiar_pep ? "Sí" : "No"}
                    alerta={cuestionario.familiar_pep === true}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Documentos DDR con hash de integridad */}
          {(documentosDdr?.count ?? 0) > 0 && (
            <Card title="Documentación de soporte DDR">
              <div className="space-y-2">
                {documentosDdr?.data.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: "#040d1c" }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileText
                        size={14}
                        className="flex-shrink-0"
                        style={{ color: "#c9a84c" }}
                      />
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm"
                          style={{ color: "#f0ede8" }}
                        >
                          {d.nombre}
                        </p>
                        {d.hash_sha256 && (
                          <p
                            className="truncate font-mono text-[10px]"
                            style={{ color: "#4a6080" }}
                            title={d.hash_sha256}
                          >
                            SHA-256: {d.hash_sha256.slice(0, 16)}…
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className="flex-shrink-0 text-xs"
                      style={{ color: "#8a9bb5" }}
                    >
                      {formatBytes(d.tamanio)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Acciones según rol y estado ── */}

          {/* 1. Asignar analista — Oficial, caso ABIERTO */}
          {caso.status === "ABIERTO" && esOficial && (
            <Card title="Asignar analista investigador">
              <p className="mb-3 text-xs" style={{ color: "#8a9bb5" }}>
                Por segregación de funciones, el analista que registró el
                expediente no aparece en esta lista.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={analistaSel}
                  onChange={(e) => setAnalistaSel(e.target.value)}
                  className="h-10 min-w-[240px] rounded-lg border px-3 text-sm outline-none border-[#1b2e4a] focus:border-[#c9a84c]"
                  style={{
                    backgroundColor: "#0f1f3a",
                    color: analistaSel ? "#f0ede8" : "#4a6080",
                  }}
                >
                  <option value="">Selecciona un analista…</option>
                  {analistas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name || a.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!analistaSel || asignar.isPending}
                  onClick={() => asignar.mutate()}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
                >
                  {asignar.isPending ? "Asignando…" : "Asignar"}
                </button>
              </div>
            </Card>
          )}

          {/* 2. Completar evaluación — Analista asignado, caso EN_REVISION */}
          {rol === "ANALISTA_DDR" &&
            caso.status === "EN_REVISION" &&
            caso.analista_id === userId && (
              <button
                type="button"
                onClick={() =>
                  navigate({ to: "/casos-ddr/$id/evaluacion", params: { id } })
                }
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110"
                style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
              >
                <ClipboardCheck size={16} />
                Completar evaluación DDR
              </button>
            )}

          {/* 3. Revisión del Oficial — caso EN_REVISION_OFICIAL */}
          {caso.status === "EN_REVISION_OFICIAL" && esOficial && (
            <Card title="Revisión del Oficial de Cumplimiento">
              <p className="mb-4 text-sm" style={{ color: "#8a9bb5" }}>
                Revisa el expediente, las respuestas del cuestionario EBR y la
                documentación de soporte. Si la investigación está completa,
                valida el caso para escalarlo a{" "}
                {caso.nivel_riesgo === "MUY_ALTO"
                  ? "el Comité de Cumplimiento"
                  : "el Gerente de Cumplimiento"}
                . Si falta información, devuélvelo al analista.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={validar.isPending}
                  onClick={() => validar.mutate()}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: "#22c55e", color: "#040d1c" }}
                >
                  {validar.isPending
                    ? "Validando…"
                    : "Validar y escalar a aprobación"}
                </button>
                <button
                  type="button"
                  onClick={() => setDevolverOpen(true)}
                  className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[rgba(201,168,76,0.08)]"
                  style={{
                    borderColor: "rgba(201,168,76,0.4)",
                    color: "#c9a84c",
                  }}
                >
                  <CornerUpLeft size={15} />
                  Devolver al analista
                </button>
              </div>
            </Card>
          )}

          {/* 4. Aprobar / Rechazar — Gerente (ALTO) o Comité (MUY_ALTO) */}
          {caso.status === "EN_APROBACION" &&
            ((caso.nivel_riesgo === "ALTO" && rol === "GERENTE_CUMPLIMIENTO") ||
              (caso.nivel_riesgo === "MUY_ALTO" &&
                rol === "COMITE_CUMPLIMIENTO") ||
              rol === "ADMIN") && (
              <Card title="Decisión de aprobación">
                <p className="mb-4 text-sm" style={{ color: "#8a9bb5" }}>
                  El caso fue investigado por el analista y validado por el
                  Oficial de Cumplimiento. La decisión final corresponde a esta
                  instancia.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={aprobar.isPending}
                    onClick={() => aprobar.mutate()}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ backgroundColor: "#22c55e", color: "#040d1c" }}
                  >
                    {aprobar.isPending ? "Aprobando…" : "Aprobar caso"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechazoOpen(true)}
                    className="rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[rgba(224,82,82,0.1)]"
                    style={{
                      borderColor: "rgba(224,82,82,0.4)",
                      color: "#e05252",
                    }}
                  >
                    Rechazar caso
                  </button>
                </div>
              </Card>
            )}

          {/* Empresa vs persona: icono contextual al final del dossier */}
          {!pn && !pj && (
            <Card title="Expediente del cliente">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#8a9bb5" }}>
                <Building2 size={14} />
                Cargando información del expediente…
              </div>
            </Card>
          )}
        </>
      ) : null}

      {/* Modal devolver al analista */}
      {devolverOpen && (
        <ModalObservaciones
          titulo="Devolver al analista"
          descripcion="Indica qué falta o qué debe corregirse (mínimo 10 caracteres). El analista verá estas observaciones en el caso."
          confirmLabel={devolver.isPending ? "Devolviendo…" : "Devolver caso"}
          confirmColor="#c9a84c"
          confirmTextColor="#040d1c"
          minimo={10}
          value={observaciones}
          onChange={setObservaciones}
          disabled={devolver.isPending}
          onCancel={() => {
            setDevolverOpen(false)
            setObservaciones("")
          }}
          onConfirm={() => devolver.mutate()}
        />
      )}

      {/* Modal rechazo */}
      {rechazoOpen && (
        <ModalObservaciones
          titulo="Rechazar caso"
          descripcion="Indica el motivo del rechazo (mínimo 20 caracteres)."
          confirmLabel={rechazar.isPending ? "Rechazando…" : "Confirmar rechazo"}
          confirmColor="#e05252"
          confirmTextColor="#fff"
          minimo={20}
          value={observaciones}
          onChange={setObservaciones}
          disabled={rechazar.isPending}
          onCancel={() => {
            setRechazoOpen(false)
            setObservaciones("")
          }}
          onConfirm={() => rechazar.mutate()}
        />
      )}
    </div>
  )
}

function ModalObservaciones({
  titulo,
  descripcion,
  confirmLabel,
  confirmColor,
  confirmTextColor,
  minimo,
  value,
  onChange,
  disabled,
  onCancel,
  onConfirm,
}: {
  titulo: string
  descripcion: string
  confirmLabel: string
  confirmColor: string
  confirmTextColor: string
  minimo: number
  value: string
  onChange: (v: string) => void
  disabled: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(4,13,28,0.85)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
      >
        <h3
          className="mb-3 text-lg"
          style={{
            fontFamily: "DM Serif Display, serif",
            color: "#f0ede8",
            fontWeight: 400,
          }}
        >
          {titulo}
        </h3>
        <p className="mb-3 text-sm" style={{ color: "#8a9bb5" }}>
          {descripcion}
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border p-3 text-sm text-[#f0ede8] outline-none border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a" }}
          placeholder="Observaciones…"
        />
        <p
          className="mt-1 text-xs"
          style={{ color: value.length >= minimo ? "#22c55e" : "#4a6080" }}
        >
          {value.length}/{minimo}
        </p>
        <div className="mt-4 flex gap-3">
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
            disabled={value.length < minimo || disabled}
            onClick={onConfirm}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
            style={{ backgroundColor: confirmColor, color: confirmTextColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
