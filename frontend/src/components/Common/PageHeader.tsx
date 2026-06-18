import type { ReactNode } from "react"

// Encabezado de página consistente para todas las pantallas internas.
// Usa clases de Tailwind en vez de colores hardcodeados para que el título
// y el subtítulo se adapten al tema activo (light/dark).
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
          className="text-[28px] leading-tight text-foreground"
          style={{ fontFamily: "DM Serif Display, serif", fontWeight: 400 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
