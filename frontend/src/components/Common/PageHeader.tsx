import type { ReactNode } from "react"

// Encabezado de página consistente para todas las pantallas internas.
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1
          className="text-[28px] leading-tight"
          style={{
            fontFamily: "DM Serif Display, serif",
            color: "#f0ede8",
            fontWeight: 400,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm" style={{ color: "#4a6080" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
