export interface BarListItem {
  label: string
  value: number
  color: string
}

// Tarjeta con un pequeño gráfico de barras horizontales para comparar
// magnitudes entre categorías (ej. casos por estado, clientes por nivel de
// riesgo). El ancho de cada barra es relativo al valor máximo del set.
export function BarListCard({
  title,
  items,
  loading,
}: {
  title: string
  items: BarListItem[]
  loading?: boolean
}) {
  const max = Math.max(1, ...items.map((i) => i.value))

  return (
    <div className="bg-card text-card-foreground rounded-xl border p-5">
      <h3 className="text-muted-foreground mb-4 text-sm font-medium">
        {title}
      </h3>
      {loading ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="bg-muted h-6 animate-pulse rounded-md"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-36 shrink-0 truncate text-sm">
                {item.label}
              </span>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
