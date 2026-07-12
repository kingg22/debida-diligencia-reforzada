import { AlertCircle, Inbox, Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"

// Estados visuales reutilizables para llamadas async (carga, error, vacío).
// Usan clases de Tailwind para adaptarse al tema activo.

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border py-16">
      <Loader2 size={22} className="text-primary animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/25 bg-red-500/5 py-16 text-center">
      <AlertCircle size={22} className="text-red-500" />
      <p className="text-red-500 max-w-md text-sm">
        {message || "No se pudo cargar la información."}
      </p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

export function EmptyState({
  message,
  action,
}: {
  message: string
  action?: ReactNode
}) {
  return (
    <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-center">
      <Inbox size={22} />
      <p className="max-w-md text-sm">{message}</p>
      {action}
    </div>
  )
}
