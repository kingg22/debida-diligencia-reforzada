import { createFileRoute } from "@tanstack/react-router"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Inbox,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { KpiCard } from "@/components/Common/KpiCard"
import { PageHeader } from "@/components/Common/PageHeader"
import useAuth from "@/hooks/useAuth"
import { useDashboard } from "@/hooks/useDashboard"
import type { DashboardData } from "@/client/sgddr"
import { type AppUser, ROL_LABELS, type Rol } from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [{ title: "Inicio — PanamaCompliance SGDDR" }],
  }),
})

interface KpiDef {
  key: keyof DashboardData
  icon: LucideIcon
  label: string
  color: string
}

// KPIs por rol según el documento consolidado (sección dashboard).
const KPIS_POR_ROL: Record<string, KpiDef[]> = {
  OFICIAL_CUMPLIMIENTO: [
    { key: "clientes_registrados_hoy", icon: UserCheck, label: "Clientes registrados hoy", color: "#c9a84c" },
    { key: "clientes_pendientes_revision", icon: Clock, label: "Pendientes de revisión", color: "#eab308" },
    { key: "casos_ddr_abiertos", icon: FolderOpen, label: "Casos DDR abiertos", color: "#60a5fa" },
    { key: "casos_ddr_en_revision", icon: ClipboardList, label: "Casos DDR en revisión", color: "#F57C00" },
  ],
  ANALISTA_DDR: [
    { key: "mis_casos_abiertos", icon: FolderOpen, label: "Mis casos abiertos", color: "#60a5fa" },
    { key: "mis_casos_en_revision", icon: ClipboardList, label: "Mis casos en revisión", color: "#F57C00" },
    { key: "casos_sin_asignar", icon: Inbox, label: "Casos sin asignar", color: "#c9a84c" },
  ],
  GERENTE_CUMPLIMIENTO: [
    { key: "casos_pendientes_aprobacion_alto", icon: AlertTriangle, label: "Pendientes de aprobación (Alto)", color: "#D32F2F" },
    { key: "dias_promedio_espera", icon: Clock, label: "Días promedio de espera", color: "#eab308" },
  ],
  COMITE_CUMPLIMIENTO: [
    { key: "casos_pendientes_aprobacion_muy_alto", icon: AlertTriangle, label: "Pendientes de aprobación (Muy Alto)", color: "#B71C1C" },
    { key: "dias_promedio_espera", icon: Clock, label: "Días promedio de espera", color: "#eab308" },
  ],
  ADMIN: [
    { key: "total_usuarios", icon: Users, label: "Total de usuarios", color: "#c9a84c" },
    { key: "usuarios_activos", icon: ShieldCheck, label: "Usuarios activos", color: "#22c55e" },
    { key: "total_clientes", icon: FileText, label: "Total de clientes", color: "#60a5fa" },
    { key: "total_casos_ddr", icon: FolderOpen, label: "Total de casos DDR", color: "#F57C00" },
  ],
  AUDITOR: [
    { key: "total_clientes", icon: FileText, label: "Total de clientes", color: "#60a5fa" },
    { key: "total_casos_ddr", icon: FolderOpen, label: "Total de casos DDR", color: "#F57C00" },
  ],
}

function Dashboard() {
  const { user } = useAuth()
  const { data, isPending, isError } = useDashboard()

  const rol = ((user as AppUser | null | undefined)?.role ?? "") as Rol | ""
  const nombre = user?.full_name || user?.email || "Usuario"
  const kpis = (rol && KPIS_POR_ROL[rol]) || []

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Bienvenido, ${nombre}`}
        subtitle={`${rol ? ROL_LABELS[rol as Rol] : ""}${rol ? " · " : ""}Sistema de Gestión de Debida Diligencia Reforzada`}
      />

      {kpis.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const value = data?.[kpi.key]
            return (
              <KpiCard
                key={kpi.key}
                icon={kpi.icon}
                label={kpi.label}
                color={kpi.color}
                loading={isPending}
                value={
                  isError || value === undefined || value === null
                    ? "—"
                    : value
                }
              />
            )
          })}
        </div>
      ) : (
        <div
          className="rounded-xl p-5"
          style={{
            backgroundColor: "rgba(201,168,76,0.06)",
            border: "1px solid rgba(201,168,76,0.20)",
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "#8a9bb5" }}>
            No hay indicadores configurados para tu rol.
          </p>
        </div>
      )}

      {isError && kpis.length > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl p-4"
          style={{
            backgroundColor: "rgba(96,165,250,0.06)",
            border: "1px solid rgba(96,165,250,0.20)",
          }}
        >
          <CheckCircle2 size={15} style={{ color: "#60a5fa" }} />
          <p className="text-xs" style={{ color: "#8a9bb5" }}>
            Los indicadores se mostrarán cuando el módulo de reportes esté
            disponible.
          </p>
        </div>
      )}
    </div>
  )
}
