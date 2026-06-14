import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Tarjeta de KPI reutilizable para el dashboard. Muestra un número grande,
// una etiqueta y un ícono con color. Soporta estado de carga (skeleton).
export function KpiCard({
  icon: Icon,
  label,
  value,
  color = "#c9a84c",
  loading,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  color?: string
  loading?: boolean
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
      {loading ? (
        <div
          className={cn("h-8 w-16 animate-pulse rounded-md")}
          style={{ backgroundColor: "#1b2e4a" }}
        />
      ) : (
        <p className="text-2xl font-semibold" style={{ color: "#f0ede8" }}>
          {value}
        </p>
      )}
    </div>
  )
}
