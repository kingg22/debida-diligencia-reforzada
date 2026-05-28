import { createFileRoute } from "@tanstack/react-router"
import { ShieldCheck, Users, FileText, AlertTriangle } from "lucide-react"
import { getCurrentUser, ROLE_LABELS } from "@/lib/mock-data"

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
  value: string
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
  const currentUser = getCurrentUser()

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1
          className="mb-1 text-[28px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Bienvenido, {currentUser?.name ?? "Usuario"}
        </h1>
        <p className="text-sm" style={{ color: "#8a9bb5" }}>
          {currentUser ? ROLE_LABELS[currentUser.role] : ""}
          {" · "}
          Sistema de Gestión de Debida Diligencia Reforzada
        </p>
      </div>

      {/* Quick-stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Usuarios registrados"
          value="12"
          color="#c9a84c"
        />
        <StatCard
          icon={ShieldCheck}
          label="Con 2FA activo"
          value="7"
          color="#60a5fa"
        />
        <StatCard
          icon={FileText}
          label="Expedientes activos"
          value="—"
          color="#86efac"
        />
        <StatCard
          icon={AlertTriangle}
          label="Alertas pendientes"
          value="—"
          color="#e05252"
        />
      </div>

      {/* Info banner */}
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: "rgba(201,168,76,0.06)",
          border: "1px solid rgba(201,168,76,0.20)",
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: "#8a9bb5" }}>
          <span style={{ color: "#c9a84c" }} className="font-medium">
            PanamaCompliance SGDDR
          </span>{" "}
          — Sistema de Gestión de Debida Diligencia Reforzada. Módulos de
          expedientes, alertas y reportes estarán disponibles próximamente.
        </p>
      </div>
    </div>
  )
}
