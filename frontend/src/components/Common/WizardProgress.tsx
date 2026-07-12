import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Barra de progreso de etapas. Reutilizada en el wizard KYC y el wizard DDR.
// Etapas completadas → check verde. Etapa actual → resaltada. Futuras → grises.
export function WizardProgress({
  steps,
  current,
}: {
  steps: string[]
  current: number // índice de la etapa actual (0-based)
}) {
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const isDone = i < current
        const isCurrent = i === current
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                )}
                style={
                  isDone
                    ? {
                        backgroundColor: "#22c55e",
                        color: "var(--primary-foreground)",
                      }
                    : isCurrent
                      ? {
                          backgroundColor: "var(--primary)",
                          color: "var(--primary-foreground)",
                        }
                      : {
                          backgroundColor: "var(--secondary)",
                          color: "var(--dim-foreground)",
                          border: "1px solid var(--border)",
                        }
                }
              >
                {isDone ? <Check size={16} /> : i + 1}
              </div>
              <span
                className="max-w-[110px] text-center text-[11px] leading-tight"
                style={{
                  color: isCurrent
                    ? "var(--foreground)"
                    : "var(--dim-foreground)",
                }}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="mx-2 h-px flex-1"
                style={{
                  backgroundColor: isDone ? "#22c55e" : "var(--accent)",
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
