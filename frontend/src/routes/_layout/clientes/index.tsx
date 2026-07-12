import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  Clock,
  FileSearch,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react"
import { useEffect, useState } from "react"
import { ClientesService } from "@/client/sgddr"
import { EstadoKYCBadge } from "@/components/Common/EstadoCasoBadge"
import { KpiCard } from "@/components/Common/KpiCard"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useAuth from "@/hooks/useAuth"
import {
  type AppUser,
  ESTADO_KYC,
  ESTADOS_KYC,
  formatFecha,
  formatIdentificacion,
  NIVEL_RIESGO,
  NIVELES_RIESGO,
  puedeRegistrarCliente,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/clientes/")({
  component: ClientesPage,
  head: () => ({
    meta: [{ title: "Clientes — PanamaCompliance SGDDR" }],
  }),
})

const PAGE_SIZE = 20

function ClientesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const rol = (user as AppUser | null | undefined)?.role

  const [searchInput, setSearchInput] = useState("")
  const [nombre, setNombre] = useState("")
  const [nivel, setNivel] = useState("")
  const [estado, setEstado] = useState("")
  const [page, setPage] = useState(1)

  // debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setNombre(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [])

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["clientes", { nombre, nivel, estado, page }],
    queryFn: () =>
      ClientesService.list({
        nombre: nombre || undefined,
        nivel_riesgo: nivel || undefined,
        estado: estado || undefined,
        page,
        size: PAGE_SIZE,
      }),
    retry: false,
    enabled: !!user,
  })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tieneFiltros = !!(searchInput || nivel || estado)

  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["clientes-estadisticas"],
    queryFn: ClientesService.estadisticas,
    retry: false,
    enabled: !!user,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Expedientes KYC registrados en el sistema."
        action={
          puedeRegistrarCliente(rol) || rol === "ANALISTA_DDR" ? (
            <Button
              type="button"
              onClick={() => navigate({ to: "/kyc/nuevo" })}
              className="bg-primary text-primary-foreground hover:brightness-110"
            >
              <Plus size={16} />
              Nuevo cliente
            </Button>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={15}
            className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            type="text"
            placeholder="Buscar por nombre o identificación…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none transition-all"
        >
          <option value="">Todos los niveles</option>
          {NIVELES_RIESGO.map((n) => (
            <option key={n} value={n}>
              {NIVEL_RIESGO[n].label}
            </option>
          ))}
        </select>

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none transition-all"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_KYC.map((kyc) => (
            <option key={kyc} value={kyc}>
              {ESTADO_KYC[kyc].label}
            </option>
          ))}
        </select>

        {tieneFiltros && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchInput("")
              setNivel("")
              setEstado("")
            }}
          >
            <X size={13} /> Limpiar
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total de clientes"
          value={stats?.total ?? 0}
          color="#c9a84c"
          loading={statsPending}
        />
        <KpiCard
          icon={Clock}
          label="Pendientes de revisión"
          value={stats?.pendientes_revision ?? 0}
          color="#f59e0b"
          loading={statsPending}
        />
        <KpiCard
          icon={FileSearch}
          label="En revisión"
          value={stats?.en_revision ?? 0}
          color="#60a5fa"
          loading={statsPending}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Riesgo alto o muy alto"
          value={stats?.riesgo_alto ?? 0}
          color="#e05252"
          loading={statsPending}
        />
      </div>

      {/* Contenido */}
      {isPending ? (
        <LoadingState label="Cargando clientes…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : data && data.data.length === 0 ? (
        <EmptyState
          message={
            tieneFiltros
              ? "No se encontraron clientes con los filtros aplicados."
              : "Aún no hay clientes registrados."
          }
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-border border-b">
                  {[
                    "Nombre",
                    "Identificación",
                    "Nivel de riesgo",
                    "Estado",
                    "Registro",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.data.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() =>
                      navigate({ to: "/clientes/$id", params: { id: c.id } })
                    }
                    className="hover:bg-muted/50 border-border cursor-pointer border-b transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <span className="text-foreground font-medium">
                        {c.nombres} {c.apellidos}
                      </span>
                      {c.es_pep && (
                        <span className="ml-2 rounded bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
                          PEP
                        </span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-4 py-3.5 font-mono text-xs">
                      {formatIdentificacion(c.numero_identificacion)}
                    </td>
                    <td className="px-4 py-3.5">
                      <NivelRiesgoBadge nivel={c.nivel_riesgo} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoKYCBadge estado={c.estado} />
                    </td>
                    <td className="text-muted-foreground px-4 py-3.5 text-xs">
                      {formatFecha(c.creado_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="border-border bg-muted/30 flex items-center justify-between border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              {total} cliente{total !== 1 ? "s" : ""}
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
