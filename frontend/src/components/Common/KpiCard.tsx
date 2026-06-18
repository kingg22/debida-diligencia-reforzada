import type { LucideIcon } from "lucide-react"

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
    <div className="bg-card text-card-foreground rounded-xl border p-5">
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      {loading ? (
        <div className="bg-muted h-8 w-16 animate-pulse rounded-md" />
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
    </div>
  )
}
