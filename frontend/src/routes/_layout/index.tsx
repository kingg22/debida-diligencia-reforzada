import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { AlertTriangle, FileText, ShieldCheck, Users } from "lucide-react"
import { DashboardService } from "@/client/sgddr"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import useAuth from "@/hooks/useAuth"
import { ROLE_LABELS, type Role } from "@/lib/roles"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Inicio — PanamaCompliance SGDDR" }],
  }),
})

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: "#0a1628", border: "1px solid #1b2e4a" }}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-sm" style={{ color: "#8a9bb5" }}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-semibold" style={{ color: "#f0ede8" }}>
        {value}
      </p>
    </div>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const displayName = user?.full_name || user?.email || "Usuario"
  const roleLabel = user?.role ? ROLE_LABELS[user.role as Role] : ""

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: DashboardService.get,
    retry: false,
  })

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1
          className="mb-1 text-[28px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Bienvenido, {displayName}
        </h1>
        <p className="text-sm" style={{ color: "#8a9bb5" }}>
          {roleLabel}
          {roleLabel && " · "}
          Sistema de Gestión de Debida Diligencia Reforzada
        </p>
      </div>

      {/* KPIs desde el backend */}
      {isPending ? (
        <LoadingState label="Cargando indicadores…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Usuarios registrados"
            value={data.total_usuarios ?? "—"}
            color="#c9a84c"
          />
          <StatCard
            icon={ShieldCheck}
            label="Expedientes KYC"
            value={data.total_clientes ?? "—"}
            color="#60a5fa"
          />
          <StatCard
            icon={FileText}
            label="Casos DDR activos"
            value={data.total_casos_ddr ?? "—"}
            color="#86efac"
          />
          <StatCard
            icon={AlertTriangle}
            label="Pendientes de aprobación"
            value={
              (data.casos_pendientes_aprobacion_alto ?? 0) +
                (data.casos_pendientes_aprobacion_muy_alto ?? 0) || "—"
            }
            color="#e05252"
          />
        </div>
      ) : (
        <EmptyState message="Sin datos del dashboard." />
      )}
    </div>
  )
}
