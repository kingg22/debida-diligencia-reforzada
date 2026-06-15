import { AlertCircle, Inbox, Loader2 } from "lucide-react"
import type { ReactNode } from "react"

// Estados visuales reutilizables para llamadas async (carga, error, vacío).

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl py-16"
      style={{ border: "1px solid #1b2e4a", backgroundColor: "#0a1628" }}
    >
      <Loader2 size={22} className="animate-spin" style={{ color: "#c9a84c" }} />
      <p className="text-sm" style={{ color: "#8a9bb5" }}>
        {label}
      </p>
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
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      style={{ border: "1px solid rgba(224,82,82,0.25)", backgroundColor: "rgba(224,82,82,0.05)" }}
    >
      <AlertCircle size={22} style={{ color: "#e05252" }} />
      <p className="max-w-md text-sm" style={{ color: "#e05252" }}>
        {message || "No se pudo cargar la información."}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-[#1b2e4a]"
          style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
        >
          Reintentar
        </button>
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
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      style={{ border: "1px solid #1b2e4a", backgroundColor: "#0a1628" }}
    >
      <Inbox size={22} style={{ color: "#4a6080" }} />
      <p className="max-w-md text-sm" style={{ color: "#8a9bb5" }}>
        {message}
      </p>
      {action}
    </div>
  )
}
