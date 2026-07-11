import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import {
  AlertTriangle,
  Clock,
  FileCheck,
  FileText,
  FileX,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  CasosDdrService,
  ClientesService,
  type CasosDdrEstadisticas,
  type ClientesEstadisticas,
  type DashboardData,
} from "@/client/sgddr"
import { BarListCard, type BarListItem } from "@/components/Common/BarListCard"
import { KpiCard } from "@/components/Common/KpiCard"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import useAuth from "@/hooks/useAuth"
import { useDashboard } from "@/hooks/useDashboard"
import { ROLE_LABELS, type Role } from "@/lib/roles"
import {
  ESTADO_CASO,
  ESTADOS_CASO,
  type EstadoCaso,
  NIVEL_RIESGO,
  NIVELES_RIESGO,
  type NivelRiesgo,
} from "@/lib/sgddr"

const CASOS_ESTADO_FIELD: Record<EstadoCaso, keyof CasosDdrEstadisticas> = {
  ABIERTO: "abiertos",
  EN_REVISION: "en_revision",
  EN_REVISION_OFICIAL: "en_revision_oficial",
  EN_APROBACION: "en_aprobacion",
  APROBADO: "aprobados",
  RECHAZADO: "rechazados",
}

const NIVEL_RIESGO_FIELD: Record<NivelRiesgo, keyof ClientesEstadisticas> = {
  BAJO: "bajo",
  MEDIO: "medio",
  ALTO: "alto",
  MUY_ALTO: "muy_alto",
}

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Inicio — PanamaCompliance SGDDR" }],
  }),
})

interface KpiConfig {
  icon: LucideIcon
  label: string
  value: string | number
  color: string
}

function buildKpis(role: Role | undefined, data: DashboardData): KpiConfig[] {
  switch (role) {
    case "ADMIN":
      return [
        {
          icon: Users,
          label: "Usuarios registrados",
          value: data.total_usuarios ?? 0,
          color: "#c9a84c",
        },
        {
          icon: UserCheck,
          label: "Usuarios activos",
          value: data.usuarios_activos ?? 0,
          color: "#4ade80",
        },
        {
          icon: ShieldCheck,
          label: "Expedientes KYC",
          value: data.total_clientes ?? 0,
          color: "#60a5fa",
        },
        {
          icon: FileText,
          label: "Casos DDR",
          value: data.total_casos_ddr ?? 0,
          color: "#86efac",
        },
      ]
    case "OFICIAL_CUMPLIMIENTO":
      return [
        {
          icon: ShieldCheck,
          label: "Clientes registrados hoy",
          value: data.clientes_registrados_hoy ?? 0,
          color: "#60a5fa",
        },
        {
          icon: Clock,
          label: "Pendientes de revisión",
          value: data.clientes_pendientes_revision ?? 0,
          color: "#f59e0b",
        },
        {
          icon: FileText,
          label: "Casos DDR abiertos",
          value: data.casos_ddr_abiertos ?? 0,
          color: "#86efac",
        },
        {
          icon: FileCheck,
          label: "Casos en revisión",
          value: data.casos_ddr_en_revision ?? 0,
          color: "#c9a84c",
        },
      ]
    case "ANALISTA_DDR":
      return [
        {
          icon: FileText,
          label: "Mis casos abiertos",
          value: data.mis_casos_abiertos ?? 0,
          color: "#86efac",
        },
        {
          icon: FileCheck,
          label: "Mis casos en revisión",
          value: data.mis_casos_en_revision ?? 0,
          color: "#c9a84c",
        },
        {
          icon: Clock,
          label: "En revisión del oficial",
          value: data.mis_casos_en_revision_oficial ?? 0,
          color: "#60a5fa",
        },
        {
          icon: AlertTriangle,
          label: "Casos sin asignar",
          value: data.casos_sin_asignar ?? 0,
          color: "#e05252",
        },
      ]
    case "GERENTE_CUMPLIMIENTO":
      return [
        {
          icon: AlertTriangle,
          label: "Pendientes de aprobación (Alto)",
          value: data.casos_pendientes_aprobacion_alto ?? 0,
          color: "#e05252",
        },
        {
          icon: Clock,
          label: "Días promedio de espera",
          value: `${data.dias_promedio_espera ?? 0}`,
          color: "#f59e0b",
        },
        {
          icon: FileCheck,
          label: "Aprobados (Alto)",
          value: data.casos_aprobados_alto ?? 0,
          color: "#4ade80",
        },
        {
          icon: FileX,
          label: "Rechazados (Alto)",
          value: data.casos_rechazados_alto ?? 0,
          color: "#f87171",
        },
      ]
    case "COMITE_CUMPLIMIENTO":
      return [
        {
          icon: AlertTriangle,
          label: "Pendientes de aprobación (Muy alto)",
          value: data.casos_pendientes_aprobacion_muy_alto ?? 0,
          color: "#e05252",
        },
        {
          icon: Clock,
          label: "Días promedio de espera",
          value: `${data.dias_promedio_espera ?? 0}`,
          color: "#f59e0b",
        },
        {
          icon: FileCheck,
          label: "Aprobados (Muy alto)",
          value: data.casos_aprobados_muy_alto ?? 0,
          color: "#4ade80",
        },
        {
          icon: FileX,
          label: "Rechazados (Muy alto)",
          value: data.casos_rechazados_muy_alto ?? 0,
          color: "#f87171",
        },
      ]
    case "AUDITOR":
      return [
        {
          icon: ShieldCheck,
          label: "Expedientes KYC",
          value: data.total_clientes ?? 0,
          color: "#60a5fa",
        },
        {
          icon: FileText,
          label: "Casos DDR",
          value: data.total_casos_ddr ?? 0,
          color: "#86efac",
        },
        {
          icon: FileCheck,
          label: "Casos aprobados",
          value: data.casos_aprobados ?? 0,
          color: "#4ade80",
        },
        {
          icon: FileX,
          label: "Casos rechazados",
          value: data.casos_rechazados ?? 0,
          color: "#f87171",
        },
      ]
    default:
      return []
  }
}

function Dashboard() {
  const { user } = useAuth()
  const role = user?.role as Role | undefined
  const displayName = user?.full_name || user?.email || "Usuario"
  const roleLabel = role ? ROLE_LABELS[role] : ""

  const { data, isPending, isError, error, refetch } = useDashboard()

  const kpis = data ? buildKpis(role, data) : []

  const { data: clientesStats, isPending: clientesStatsPending } = useQuery({
    queryKey: ["clientes-estadisticas"],
    queryFn: ClientesService.estadisticas,
    retry: false,
    enabled: !!user,
  })

  const { data: casosStats, isPending: casosStatsPending } = useQuery({
    queryKey: ["casos-ddr-estadisticas"],
    queryFn: CasosDdrService.estadisticas,
    retry: false,
    enabled: !!user,
  })

  const casosPorEstado: BarListItem[] = ESTADOS_CASO.map((estado) => ({
    label: ESTADO_CASO[estado].label,
    value: casosStats?.[CASOS_ESTADO_FIELD[estado]] ?? 0,
    color: ESTADO_CASO[estado].color,
  }))

  const clientesPorNivel: BarListItem[] = NIVELES_RIESGO.map((nivel) => ({
    label: NIVEL_RIESGO[nivel].label,
    value: clientesStats?.[NIVEL_RIESGO_FIELD[nivel]] ?? 0,
    color: NIVEL_RIESGO[nivel].color,
  }))

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1
          className="mb-1 text-[28px] text-foreground"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          Bienvenido, {displayName}
        </h1>
        <p className="text-muted-foreground text-sm">
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
      ) : kpis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              icon={kpi.icon}
              label={kpi.label}
              value={kpi.value}
              color={kpi.color}
            />
          ))}
        </div>
      ) : (
        <EmptyState message="Sin datos del dashboard." />
      )}

      {/* Distribución */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarListCard
          title="Casos DDR por estado"
          items={casosPorEstado}
          loading={casosStatsPending}
        />
        <BarListCard
          title="Clientes por nivel de riesgo"
          items={clientesPorNivel}
          loading={clientesStatsPending}
        />
      </div>
    </div>
  )
}
