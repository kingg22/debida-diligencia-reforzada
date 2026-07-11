import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, FileClock, FileText, FolderOpen } from "lucide-react"
import { useEffect, useState } from "react"
import { CasosDdrService } from "@/client/sgddr"
import { EstadoCasoBadge } from "@/components/Common/EstadoCasoBadge"
import { KpiCard } from "@/components/Common/KpiCard"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { Button } from "@/components/ui/button"
import {
  diasDesde,
  ESTADO_CASO,
  ESTADOS_CASO,
  formatIdentificacion,
  NIVEL_RIESGO,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/casos-ddr/")({
  component: CasosDdrPage,
  head: () => ({
    meta: [{ title: "Casos DDR — PanamaCompliance SGDDR" }],
  }),
})

const PAGE_SIZE = 20

function CasosDdrPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState("")
  const [nivel, setNivel] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [])

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["casos-ddr", { estado, nivel, page }],
    queryFn: () =>
      CasosDdrService.list({
        estado: estado || undefined,
        nivel_riesgo: nivel || undefined,
        page,
        size: PAGE_SIZE,
      }),
    retry: false,
  })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["casos-ddr-estadisticas"],
    queryFn: CasosDdrService.estadisticas,
    retry: false,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Casos DDR"
        subtitle="Expedientes en proceso de Debida Diligencia Reforzada."
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none transition-all"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CASO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_CASO[e].label}
            </option>
          ))}
        </select>

        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none transition-all"
        >
          <option value="">Todos los niveles</option>
          {(["ALTO", "MUY_ALTO"] as const).map((n) => (
            <option key={n} value={n}>
              {NIVEL_RIESGO[n].label}
            </option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={FolderOpen}
          label="Total de casos"
          value={stats?.total ?? 0}
          color="#c9a84c"
          loading={statsPending}
        />
        <KpiCard
          icon={FileText}
          label="Abiertos"
          value={stats?.abiertos ?? 0}
          color="#86efac"
          loading={statsPending}
        />
        <KpiCard
          icon={FileClock}
          label="En revisión"
          value={stats?.en_revision ?? 0}
          color="#60a5fa"
          loading={statsPending}
        />
        <KpiCard
          icon={AlertTriangle}
          label="En aprobación"
          value={stats?.en_aprobacion ?? 0}
          color="#e05252"
          loading={statsPending}
        />
      </div>

      {isPending ? (
        <LoadingState label="Cargando casos…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : data && data.data.length === 0 ? (
        <EmptyState message="No hay casos DDR para mostrar." />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-border border-b">
                  {["Cliente", "Nivel de riesgo", "Estado", "Días abierto"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data?.data.map((caso) => (
                  <tr
                    key={caso.id}
                    onClick={() =>
                      navigate({
                        to: "/casos-ddr/$id",
                        params: { id: caso.id },
                      })
                    }
                    className="hover:bg-muted/50 border-border cursor-pointer border-b transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-foreground font-medium">
                          {caso.cliente
                            ? `${caso.cliente.nombres} ${caso.cliente.apellidos}`.trim() ||
                              caso.cliente.codigo
                            : `Expediente ${caso.expediente_id.slice(0, 8)}…`}
                        </span>
                        {caso.cliente && (
                          <span
                            className="text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {formatIdentificacion(
                              caso.cliente.numero_identificacion,
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <NivelRiesgoBadge nivel={caso.nivel_riesgo} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoCasoBadge estado={caso.status} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3.5 text-xs">
                      {diasDesde(caso.fecha_apertura)} días
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border bg-muted/30 flex items-center justify-between border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {total} caso{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground text-xs">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}