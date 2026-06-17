import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeft, FileText } from "lucide-react"
import { ClientesService } from "@/client/sgddr"
import { EstadoKYCBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { ErrorState, LoadingState } from "@/components/Common/QueryStates"
import { formatFecha } from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/clientes/$id")({
  component: ClienteDetallePage,
  head: () => ({
    meta: [{ title: "Detalle de cliente — PanamaCompliance SGDDR" }],
  }),
})

function Campo({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "#4a6080" }}>
        {label}
      </p>
      <p className="mt-0.5 text-sm" style={{ color: "#f0ede8" }}>
        {value || "—"}
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

function ClienteDetallePage() {
  const { id } = useParams({ from: "/_layout/clientes/$id" })
  const navigate = useNavigate()

  const {
    data: c,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => ClientesService.get(id),
    retry: false,
    enabled: !!id,
  })

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate({ to: "/clientes" })}
        className="flex items-center gap-1.5 text-sm transition-colors hover:text-[#c9a84c]"
        style={{ color: "#8a9bb5" }}
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
      ) : c ? (
        <>
          <PageHeader
            title={`${c.nombres} ${c.apellidos}`}
            subtitle={`${c.tipo_identificacion} · ${c.numero_identificacion}`}
            action={
              <div className="flex items-center gap-2">
                <NivelRiesgoBadge nivel={c.nivel_riesgo} />
                <EstadoKYCBadge estado={c.estado} />
              </div>
            }
          />

          {c.es_pep && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                backgroundColor: "rgba(201,168,76,0.08)",
                border: "1px solid rgba(201,168,76,0.25)",
                color: "#c9a84c",
              }}
            >
              Cliente identificado como PEP (Persona Expuesta Políticamente) —
              Ley 23/2015 Art. 24. Requiere Debida Diligencia Reforzada.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Datos personales">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Nombres" value={c.nombres} />
                <Campo label="Apellidos" value={c.apellidos} />
                <Campo
                  label="Fecha de nacimiento"
                  value={formatFecha(c.fecha_nacimiento)}
                />
                <Campo label="Nacionalidad" value={c.nacionalidad} />
                <Campo label="País de residencia" value={c.pais_residencia} />
                <Campo label="Correo" value={c.correo} />
                <Campo label="Teléfono" value={c.telefono} />
              </div>
            </Card>

            <Card title="Información económica">
              <div className="grid grid-cols-2 gap-4">
                <Campo label="Ocupación" value={c.ocupacion} />
                <Campo label="Fuente de ingresos" value={c.fuente_ingresos} />
                <Campo
                  label="Ingresos mensuales"
                  value={c.ingresos_mensuales_usd}
                />
                <Campo
                  label="Propósito de la relación"
                  value={c.proposito_relacion}
                />
                <Campo
                  label="Puntaje de riesgo"
                  value={String(c.puntaje_riesgo)}
                />
                <Campo label="Registro" value={formatFecha(c.creado_en)} />
              </div>
            </Card>
          </div>

          <Card title="Documentos">
            {c.documentos && c.documentos.length > 0 ? (
              <div className="space-y-2">
                {c.documentos.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: "#0f1f3a" }}
                  >
                    <FileText size={16} style={{ color: "#8a9bb5" }} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm"
                        style={{ color: "#f0ede8" }}
                      >
                        {d.nombre}
                      </p>
                      <p className="text-xs" style={{ color: "#4a6080" }}>
                        {d.tipo} · {formatFecha(d.fecha_carga)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#4a6080" }}>
                No hay documentos cargados.
              </p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
