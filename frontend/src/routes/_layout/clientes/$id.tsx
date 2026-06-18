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
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-0.5 text-sm">{value || "—"}</p>
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
            <div className="bg-primary/10 text-primary border-primary/25 rounded-xl border px-4 py-3 text-sm">
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
                    className="bg-muted/40 flex items-center gap-3 rounded-lg px-3 py-2.5"
                  >
                    <FileText size={16} className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm">
                        {d.nombre}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {d.tipo} · {formatFecha(d.fecha_carga)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No hay documentos cargados.
              </p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}