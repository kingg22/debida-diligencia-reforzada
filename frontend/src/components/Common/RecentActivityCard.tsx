import type { AuditoriaEntry } from "@/client/sgddr"
import { formatFechaHora } from "@/lib/sgddr"

// Panel de actividad reciente (últimas entradas de auditoría) para el
// dashboard. Solo se usa con roles que tienen acceso a `/auditoria/`
// (Auditor / superusuario) — ver `require_roles` en el backend.
export function RecentActivityCard({
  entries,
  loading,
}: {
  entries: AuditoriaEntry[]
  loading?: boolean
}) {
  return (
    <div className="bg-card text-card-foreground rounded-xl border p-5">
      <h3 className="text-muted-foreground mb-4 text-sm font-medium">
        Actividad reciente
      </h3>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted h-8 animate-pulse rounded-md" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin actividad reciente.</p>
      ) : (
        <ul className="divide-border -mx-1 divide-y">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-1 py-2.5">
              <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                {e.modulo}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{e.descripcion ?? e.accion}</p>
                <p className="text-muted-foreground text-xs">
                  {e.usuario_nombre ?? "Sistema"} ·{" "}
                  {formatFechaHora(e.creado_en)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
