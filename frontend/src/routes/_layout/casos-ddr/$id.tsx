import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { UsersService } from "@/client"
import { CasosDdrService, SgddrApiError } from "@/client/sgddr"
import { EstadoCasoBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { ErrorState, LoadingState } from "@/components/Common/QueryStates"
import { WizardProgress } from "@/components/Common/WizardProgress"
import useAuth from "@/hooks/useAuth"
import { type AppUser, formatFecha } from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/casos-ddr/$id")({
  component: CasoDetallePage,
  head: () => ({
    meta: [{ title: "Detalle de caso DDR — PanamaCompliance SGDDR" }],
  }),
})

const ETAPAS = [
  "EBR",
  "Documentos",
  "En revisión",
  "En aprobación",
  "Resolución",
]

function etapaActual(estado: string): number {
  switch (estado) {
    case "ABIERTO":
      return 0
    case "EN_REVISION":
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

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
    >
      <p
        className="mb-4 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "#4a6080" }}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function CasoDetallePage() {
  const { id } = useParams({ from: "/_layout/casos-ddr/$id" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const rol = (user as AppUser | null | undefined)?.role

  const [analistaSel, setAnalistaSel] = useState("")
  const [rechazoOpen, setRechazoOpen] = useState(false)
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

  // El backend embebe un resumen del cliente en el caso DDR
  // (ClienteResumen en /casos-ddr/{id}), así que ya no necesitamos un
  // round-trip a /clientes/{id} — eso evita errores 403 para roles con
  // AccesoDDR pero sin AccesoKYC (GERENTE, COMITE, AUDITOR).
  const cliente = caso?.cliente

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
  const analistas = ((usuarios?.data ?? []) as AppUser[]).filter(
    (u) => u.role === "ANALISTA_DDR",
  )

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["caso-ddr", id] })
    queryClient.invalidateQueries({
      queryKey: ["caso-ddr", id, "cuestionario"],
    })
    queryClient.invalidateQueries({ queryKey: ["caso-ddr", id, "documentos"] })
  }

  const asignar = useMutation({
    mutationFn: () => CasosDdrService.asignar(id, analistaSel),
    onSuccess: () => {
      toast.success("Analista asignado.")
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const aprobar = useMutation({
    mutationFn: () => CasosDdrService.aprobar(id),
    onSuccess: () => {
      toast.success("Caso aprobado.")
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rechazar = useMutation({
    mutationFn: () => CasosDdrService.rechazar(id, { observaciones }),
    onSuccess: () => {
      toast.success("Caso rechazado.")
      setRechazoOpen(false)
      setObservaciones("")
      invalidar()
    },
    onError: (e: Error) => {
      const msg = e instanceof SgddrApiError ? e.detail : e.message
      toast.error(msg || "No se pudo rechazar el caso")
    },
  })

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
                ? `${cliente.tipo_identificacion} · ${cliente.numero_identificacion}`
                : `Caso #${caso.id.slice(0, 8)}`
            }
            action={
              <div className="flex items-center gap-2">
                <NivelRiesgoBadge nivel={caso.nivel_riesgo} />
                <EstadoCasoBadge estado={caso.status} />
              </div>
            }
          />

          {/* Wizard de etapas */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
          >
            <WizardProgress steps={ETAPAS} current={etapaActual(caso.status)} />
          </div>

          {/* Observaciones de rechazo (si aplica) */}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs" style={{ color: "#4a6080" }}>
                  Fecha de apertura
                </p>
                <p className="mt-0.5 text-sm" style={{ color: "#f0ede8" }}>
                  {formatFecha(caso.fecha_apertura)}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#4a6080" }}>
                  Cuestionario EBR
                </p>
                <p className="mt-0.5 text-sm" style={{ color: "#f0ede8" }}>
                  {cuestionario?.completado ? "Completado" : "Pendiente"}
                </p>
              </div>
              <div>
                <p className="text-xs" style={{ color: "#4a6080" }}>
                  Documentos
                </p>
                <p className="mt-0.5 text-sm" style={{ color: "#f0ede8" }}>
                  {documentosDdr?.count ?? 0} cargado(s)
                </p>
              </div>
            </div>
          </Card>

          {/* Acciones según rol y estado */}
          {/* Asignar analista — Oficial, caso ABIERTO */}
          {caso.status === "ABIERTO" &&
            (rol === "OFICIAL_CUMPLIMIENTO" || rol === "ADMIN") && (
              <Card title="Asignar analista">
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

          {/* Completar evaluación — Analista, caso ABIERTO o EN_REVISION */}
          {rol === "ANALISTA_DDR" &&
            (caso.status === "ABIERTO" || caso.status === "EN_REVISION") && (
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

          {/* Aprobar / Rechazar — Gerente (ALTO) o Comité (MUY_ALTO), caso EN_APROBACION */}
          {caso.status === "EN_APROBACION" &&
            ((caso.nivel_riesgo === "ALTO" && rol === "GERENTE_CUMPLIMIENTO") ||
              (caso.nivel_riesgo === "MUY_ALTO" &&
                rol === "COMITE_CUMPLIMIENTO")) && (
              <Card title="Decisión de aprobación">
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
        </>
      ) : null}

      {/* Modal de rechazo */}
      {rechazoOpen && (
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
              Rechazar caso
            </h3>
            <p className="mb-3 text-sm" style={{ color: "#8a9bb5" }}>
              Indica el motivo del rechazo (mínimo 20 caracteres).
            </p>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={4}
              className="w-full rounded-lg border p-3 text-sm text-[#f0ede8] outline-none border-[#1b2e4a] focus:border-[#c9a84c]"
              style={{ backgroundColor: "#0f1f3a" }}
              placeholder="Motivo del rechazo…"
            />
            <p
              className="mt-1 text-xs"
              style={{
                color: observaciones.length >= 20 ? "#22c55e" : "#4a6080",
              }}
            >
              {observaciones.length}/20
            </p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setRechazoOpen(false)}
                className="flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-[#1b2e4a]"
                style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={observaciones.length < 20 || rechazar.isPending}
                onClick={() => rechazar.mutate()}
                className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: "#e05252", color: "#fff" }}
              >
                {rechazar.isPending ? "Rechazando…" : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
