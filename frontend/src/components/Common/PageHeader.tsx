import type { ReactNode } from "react"

// Encabezado de página consistente para todas las pantallas internas.
// La regla dorada bajo el título es la firma visual del sistema: evoca la
// línea de asiento de un libro de registros (la app ES un registro regulado).
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
        <h1 className="font-serif text-[28px] leading-tight text-foreground">
          {title}
        </h1>
        <div
          aria-hidden
          className="mt-1.5 h-[2.5px] w-10 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, #c9a84c 0%, rgba(201,168,76,0.12) 100%)",
          }}
        />
        {subtitle && (
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
