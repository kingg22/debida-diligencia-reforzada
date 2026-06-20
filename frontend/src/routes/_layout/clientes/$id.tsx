import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  ShieldAlert,
  X,
} from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  ClientesRiesgoService,
  ClientesService,
  type Documento,
  type ExpedienteKYC,
} from "@/client/sgddr"
import { EstadoKYCBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { DocumentoPreviewDialog } from "@/components/Common/DocumentoPreviewDialog"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import useAuth from "@/hooks/useAuth"
import {
  DOCUMENTO_ESTADO,
  DOCUMENTO_TIPO_LABEL,
  type DocumentoEstado,
  type DocumentoTipo,
  formatBytes,
  formatFecha,
  formatFechaHora,
  NIVEL_RIESGO,
  NIVELES_RIESGO,
  TIPO_CLIENTE_LABELS,
  type AppUser,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/clientes/$id")({
  component: ClienteDetallePage,
  head: () => ({
    meta: [{ title: "Detalle de cliente — PanamaCompliance SGDDR" }],
  }),
})

// ── Helpers de UI ────────────────────────────────────────────────────────

function Campo({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-0.5 text-sm">
        {value === null || value === undefined || value === "" ? "—" : String(value)}
      </p>
    </div>
  )
}

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <p className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-wider">
        {title}
      </p>
      {children}
    </div>
  )
}

function BoolPill({ value }: { value?: boolean | null }) {
  const isTrue = value === true
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: isTrue ? "rgba(34,197,94,0.14)" : "rgba(224,82,82,0.10)",
        color: isTrue ? "#22c55e" : "#8a9bb5",
      }}
    >
      {isTrue ? <Check size={12} /> : <X size={12} />}
      {isTrue ? "Sí" : "No"}
    </span>
  )
}

function DocumentoEstadoBadge({ estado }: { estado?: string | null }) {
  const key = (estado || "") as DocumentoEstado
  const cfg = DOCUMENTO_ESTADO[key]
  if (!cfg) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "rgba(138,155,181,0.12)", color: "#8a9bb5" }}
      >
        {estado || "—"}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

const USD = new Intl.NumberFormat("es-PA", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})
function formatMoneda(value?: number | null): string {
  if (value === null || value === undefined) return "—"
  return USD.format(value)
}

// ── Página ───────────────────────────────────────────────────────────────

function ClienteDetallePage() {
  const { id } = useParams({ from: "/_layout/clientes/$id" })
  const navigate = useNavigate()
  const { user } = useAuth()
  const rol = (user as AppUser | null | undefined)?.role
  const [previewDoc, setPreviewDoc] = useState<Documento | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["expediente", id],
    queryFn: () => ClientesService.getExpediente(id),
    retry: false,
    enabled: !!id,
  })

  const handleDownload = async (doc: Documento) => {
    setDownloadingId(doc.id)
    try {
      const blob = await ClientesService.descargarDocumento(id, doc.id, "attachment")
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.nombre
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate({ to: "/clientes" })}
        className="text-muted-foreground hover:text-primary flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft size={15} /> Volver a clientes
      </button>

      {isPending ? (
        <LoadingState label="Cargando expediente…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : data ? (
        <DetalleBody
          data={data}
          rol={rol}
          downloadingId={downloadingId}
          onPreview={setPreviewDoc}
          onDownload={handleDownload}
        />
      ) : null}

      <DocumentoPreviewDialog
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        expedienteId={id}
        documento={previewDoc}
      />
    </div>
  )
}

// ── Cuerpo: header + tabs ───────────────────────────────────────────────

function TabRiesgo({ expedienteId, rol }: { expedienteId: string; rol?: string }) {
  const qc = useQueryClient()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["factores-riesgo", expedienteId],
    queryFn: () => ClientesRiesgoService.factores(expedienteId),
    enabled: !!expedienteId,
  })

  const [showOverride, setShowOverride] = useState(false)
  const [nivelOverride, setNivelOverride] = useState("MEDIO")
  const [justificacion, setJustificacion] = useState("")

  const overrideMutation = useMutation({
    mutationFn: () =>
      ClientesRiesgoService.overrideRiesgo(
        expedienteId,
        nivelOverride,
        justificacion,
      ),
    onSuccess: () => {
      toast.success("Nivel de riesgo ajustado correctamente.")
      setShowOverride(false)
      setJustificacion("")
      qc.invalidateQueries({ queryKey: ["expediente", expedienteId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isPending) return <LoadingState label="Calculando factores…" />
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    )

  const factores = data?.factores ?? []
  const mayorContribuyente = factores.length
    ? Math.max(...factores.map((f) => f.contribucion))
    : 0

  return (
    <div className="space-y-4">
      {/* Resumen */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-card rounded-lg border px-5 py-3">
          <p className="text-muted-foreground text-xs">Nivel calculado</p>
          <p className="text-foreground mt-0.5 text-lg font-semibold">
            {data?.nivel ?? "—"}
          </p>
        </div>
        <div className="bg-card rounded-lg border px-5 py-3">
          <p className="text-muted-foreground text-xs">Puntaje total</p>
          <p className="text-foreground mt-0.5 text-lg font-semibold tabular-nums">
            {data?.puntaje ?? 0} pts
          </p>
        </div>
        {rol === "OFICIAL_CUMPLIMIENTO" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOverride(true)}
            className="ml-auto gap-1.5"
          >
            <Pencil size={14} /> Ajustar nivel
          </Button>
        )}
      </div>

      {/* Tabla de factores */}
      {factores.length === 0 ? (
        <EmptyState message="No hay factores activos para este expediente." />
      ) : (
        <Card title="Factores que contribuyen al nivel de riesgo">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factor</TableHead>
                <TableHead className="text-right w-20">Peso</TableHead>
                <TableHead className="text-right w-20">Valor</TableHead>
                <TableHead className="text-right w-24">Contribución</TableHead>
                <TableHead className="w-40">Aporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {factores.map((f) => {
                const pct =
                  mayorContribuyente > 0
                    ? (f.contribucion / mayorContribuyente) * 100
                    : 0
                return (
                  <TableRow key={f.factor}>
                    <TableCell className="font-medium">{f.factor}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {f.peso}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.valor}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {f.contribucion}
                    </TableCell>
                    <TableCell>
                      <div
                        className="h-2 w-full rounded-full"
                        style={{ backgroundColor: "rgba(138,155,181,0.18)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: "#c9a84c",
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialog de override (solo OFICIAL) */}
      {showOverride && (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-xl border p-6 shadow-lg">
            <h2 className="text-foreground mb-4 text-base font-semibold">
              Ajuste manual de nivel de riesgo
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Nuevo nivel
                </label>
                <select
                  value={nivelOverride}
                  onChange={(e) => setNivelOverride(e.target.value)}
                  className="border-input bg-background text-foreground focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none"
                >
                  {NIVELES_RIESGO.map((n) => (
                    <option key={n} value={n}>
                      {NIVEL_RIESGO[n]?.label ?? n}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Justificación (mínimo 10 caracteres)
                </label>
                <textarea
                  rows={3}
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  placeholder="Describe el motivo del ajuste manual…"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
                  maxLength={500}
                />
                <p className="text-muted-foreground mt-0.5 text-right text-xs">
                  {justificacion.length}/500
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowOverride(false)
                    setJustificacion("")
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={
                    justificacion.trim().length < 10 ||
                    overrideMutation.isPending
                  }
                  onClick={() => overrideMutation.mutate()}
                >
                  {overrideMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}{" "}
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetalleBody({
  data,
  rol,
  downloadingId,
  onPreview,
  onDownload,
}: {
  data: ExpedienteKYC
  rol?: string
  downloadingId: string | null
  onPreview: (d: Documento) => void
  onDownload: (d: Documento) => void
}) {
  const isNatural = data.tipo_cliente === "NATURAL"
  const pn = data.persona_natural
  const pj = data.persona_juridica
  const bfs = data.beneficiarios_final ?? []
  const docs = data.documentos ?? []

  const totalPorcentaje = bfs.reduce(
    (s, b) => s + (b.porcentaje_participacion ?? 0),
    0,
  )
  const porcentajeOk = Math.abs(totalPorcentaje - 100) < 0.01

  const displayName = isNatural
    ? `${pn?.nombre ?? ""} ${pn?.apellido ?? ""}`.trim() || "—"
    : pj?.razon_social || "—"
  const displayId = isNatural
    ? `${pn?.tipo_documento ?? ""} ${pn?.numero_documento ?? ""}`.trim() || "—"
    : pj?.ruc
      ? `RUC ${pj.ruc}`
      : "—"

  const showPep =
    (isNatural && (pn?.es_pep || pn?.es_pep_familiar)) ||
    (bfs ?? []).some((b) => b.es_pep)

  return (
    <>
      <PageHeader
        title={displayName}
        subtitle={`${TIPO_CLIENTE_LABELS[data.tipo_cliente]} · ${displayId}`}
        action={
          <div className="flex items-center gap-2">
            <NivelRiesgoBadge nivel={data.nivel_riesgo} />
            <EstadoKYCBadge estado={data.status} />
          </div>
        }
      />

      {data.status === "RECHAZADO" && data.comentario_rechazo && (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(224,82,82,0.10)",
            borderColor: "rgba(224,82,82,0.35)",
            color: "#e05252",
          }}
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Expediente rechazado</p>
            <p className="mt-0.5 text-xs opacity-90">
              {data.comentario_rechazo}
            </p>
          </div>
        </div>
      )}

      {showPep && (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(201,168,76,0.10)",
            borderColor: "rgba(201,168,76,0.35)",
            color: "#c9a84c",
          }}
        >
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Cliente identificado como PEP</p>
            <p className="mt-0.5 text-xs opacity-90">
              Persona Expuesta Políticamente — Ley 23/2015 Art. 24. Requiere
              Debida Diligencia Reforzada.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="informacion" className="gap-4">
        <TabsList>
          <TabsTrigger value="informacion">Información</TabsTrigger>
          <TabsTrigger value="beneficiarios">
            Beneficiarios {bfs.length > 0 ? `(${bfs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="documentos">
            Documentos {docs.length > 0 ? `(${docs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="riesgo">Evaluación de riesgo</TabsTrigger>
        </TabsList>

        {/* ── Tab: Información ─────────────────────────────────────── */}
        <TabsContent value="informacion" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Identificación (siempre) */}
            <Card title="Identificación">
              <div className="grid grid-cols-2 gap-4">
                {isNatural ? (
                  <>
                    <Campo label="Tipo de documento" value={pn?.tipo_documento} />
                    <Campo label="Número de documento" value={pn?.numero_documento} />
                    <Campo
                      label="Fecha de expiración"
                      value={formatFecha(pn?.fecha_expiracion_doc)}
                    />
                  </>
                ) : (
                  <>
                    <Campo label="Razón social" value={pj?.razon_social} />
                    <Campo label="RUC" value={pj?.ruc} />
                    <Campo
                      label="Tipo de sociedad"
                      value={pj?.tipo_sociedad}
                    />
                    <Campo
                      label="Fecha de constitución"
                      value={formatFecha(pj?.fecha_constitucion)}
                    />
                    <Campo
                      label="País de constitución"
                      value={pj?.pais_constitucion}
                    />
                    <Campo
                      label="Registro mercantil"
                      value={pj?.numero_registro_mercantil}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Información personal (NATURAL) */}
            {isNatural && (
              <Card title="Información personal">
                <div className="grid grid-cols-2 gap-4">
                  <Campo label="Nombre" value={pn?.nombre} />
                  <Campo label="Apellido" value={pn?.apellido} />
                  <Campo
                    label="Fecha de nacimiento"
                    value={formatFecha(pn?.fecha_nacimiento)}
                  />
                  <Campo label="Género" value={pn?.genero} />
                  <Campo label="Estado civil" value={pn?.estado_civil} />
                  <Campo label="Nacionalidad" value={pn?.nacionalidad} />
                  <Campo label="País de nacimiento" value={pn?.pais_nacimiento} />
                  <Campo label="País de residencia" value={pn?.pais} />
                  <Campo label="Teléfono" value={pn?.telefono} />
                  <Campo label="Correo" value={pn?.email} />
                  <Campo label="Dirección" value={pn?.direccion} />
                  <Campo label="Ciudad" value={pn?.ciudad} />
                </div>
              </Card>
            )}

            {/* Información de la empresa (JURIDICA) */}
            {!isNatural && (
              <Card title="Información de la empresa">
                <div className="grid grid-cols-2 gap-4">
                  <Campo
                    label="Actividad económica"
                    value={pj?.actividad_economica}
                  />
                  <Campo
                    label="Ingreso anual (USD)"
                    value={formatMoneda(pj?.ingreso_anual_aproximado)}
                  />
                  <Campo
                    label="Cantidad de empleados"
                    value={pj?.cantidad_empleados}
                  />
                  <Campo
                    label="Teléfono empresa"
                    value={pj?.telefono_empresa}
                  />
                  <Campo label="Correo empresa" value={pj?.email_empresa} />
                  <Campo label="Dirección fiscal" value={pj?.direccion_fiscal} />
                  <Campo label="Ciudad" value={pj?.ciudad} />
                  <Campo label="País" value={pj?.pais} />
                </div>
              </Card>
            )}

            {/* Representante legal (JURIDICA) */}
            {!isNatural && (
              <Card title="Representante legal">
                <div className="grid grid-cols-2 gap-4">
                  <Campo
                    label="Nombre"
                    value={pj?.nombre_representante}
                  />
                  <Campo
                    label="Cédula"
                    value={pj?.cedula_representante}
                  />
                  <Campo
                    label="Cargo"
                    value={pj?.cargo_representante}
                  />
                </div>
              </Card>
            )}

            {/* Información económica */}
            <Card title="Información económica">
              <div className="grid grid-cols-2 gap-4">
                {isNatural ? (
                  <>
                    <Campo label="Ocupación" value={pn?.ocupacion} />
                    <Campo label="Empleador" value={pn?.empleador} />
                    <Campo label="Fuente de ingresos" value={pn?.fuente_ingresos} />
                    <Campo
                      label="Ingreso mensual (USD)"
                      value={formatMoneda(pn?.ingreso_mensual_aproximado)}
                    />
                  </>
                ) : (
                  <>
                    <Campo
                      label="Actividad económica"
                      value={pj?.actividad_economica}
                    />
                    <Campo
                      label="Ingreso anual (USD)"
                      value={formatMoneda(pj?.ingreso_anual_aproximado)}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Alertas / PEP */}
            <Card title="Alertas y PEP">
              <div className="grid grid-cols-2 gap-4">
                {isNatural ? (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">¿Es PEP?</p>
                      <div className="mt-1">
                        <BoolPill value={pn?.es_pep} />
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">¿Familiar PEP?</p>
                      <div className="mt-1">
                        <BoolPill value={pn?.es_pep_familiar} />
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        ¿Tiene antecedentes?
                      </p>
                      <div className="mt-1">
                        <BoolPill value={pn?.tiene_antecedentes} />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        ¿Tiene accionistas anónimos?
                      </p>
                      <div className="mt-1">
                        <BoolPill value={pj?.tiene_accionistas_anonimos} />
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        ¿Opera en países de alto riesgo?
                      </p>
                      <div className="mt-1">
                        <BoolPill value={pj?.opera_en_paises_alto_riesgo} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Metadatos del expediente */}
            <Card title="Metadatos del expediente">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Código" value={data.codigo} />
                <Campo label="Puntaje de riesgo" value={data.puntaje_riesgo} />
                <Campo label="Creado" value={formatFechaHora(data.created_at)} />
                <Campo label="Actualizado" value={formatFechaHora(data.updated_at)} />
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: Beneficiarios ────────────────────────────────────── */}
        <TabsContent value="beneficiarios">
          {bfs.length === 0 ? (
            <EmptyState message="Este expediente no incluye beneficiarios finales." />
          ) : (
            <Card title={`Beneficiarios finales (${bfs.length})`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre completo</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Nacimiento</TableHead>
                    <TableHead className="text-right">% Participación</TableHead>
                    <TableHead>PEP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bfs.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.nombre} {b.apellido}
                      </TableCell>
                      <TableCell>{b.cedula || "—"}</TableCell>
                      <TableCell>{b.pais || "—"}</TableCell>
                      <TableCell>{formatFecha(b.fecha_nacimiento)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(b.porcentaje_participacion ?? 0).toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        <BoolPill value={b.es_pep} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Barra de progreso: Ley 254/2021 exige suma 100% */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Total participación
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: porcentajeOk ? "#22c55e" : "#e05252" }}
                  >
                    {totalPorcentaje.toFixed(2)}%
                    {porcentajeOk ? " ✓" : " — suma incorrecta"}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: "rgba(138,155,181,0.18)" }}
                >
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(100, totalPorcentaje)}%`,
                      backgroundColor: porcentajeOk ? "#c9a84c" : "#e05252",
                    }}
                  />
                </div>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Evaluación de riesgo ─────────────────────────────── */}
        <TabsContent value="riesgo">
          <TabRiesgo expedienteId={data.id} rol={rol} />
        </TabsContent>

        {/* ── Tab: Documentos ───────────────────────────────────────── */}
        <TabsContent value="documentos">
          {docs.length === 0 ? (
            <EmptyState message="No hay documentos cargados." />
          ) : (
            <Card title={`Documentos (${docs.length})`}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Tamaño</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha de carga</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((d) => {
                    const isDownloading = downloadingId === d.id
                    const tipoLabel =
                      DOCUMENTO_TIPO_LABEL[d.tipo as DocumentoTipo] ?? d.tipo
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText
                              size={14}
                              className="text-muted-foreground shrink-0"
                            />
                            <span className="truncate">{d.nombre}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {tipoLabel}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatBytes(d.tamanio)}
                        </TableCell>
                        <TableCell>
                          <DocumentoEstadoBadge estado={d.estado} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatFecha(d.fecha_carga)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onPreview(d)}
                              className="gap-1.5"
                            >
                              <Eye size={14} /> Ver
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onDownload(d)}
                              disabled={isDownloading}
                              className="gap-1.5"
                            >
                              {isDownloading ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Download size={14} />
                              )}
                              Descargar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
