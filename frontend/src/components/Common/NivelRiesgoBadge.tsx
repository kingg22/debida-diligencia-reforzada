import { NIVEL_RIESGO, type NivelRiesgo } from "@/lib/sgddr"
import { cn } from "@/lib/utils"

// Badge de nivel de riesgo. Reutilizado en lista de clientes, detalle de
// expediente, paso de confirmación del wizard KYC y lista de casos DDR.
export function NivelRiesgoBadge({
  nivel,
  size = "md",
}: {
  nivel?: string | null
  size?: "sm" | "md"
}) {
  if (!nivel || !(nivel in NIVEL_RIESGO)) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "rgba(138,155,181,0.12)", color: "#8a9bb5" }}
      >
        Sin evaluar
      </span>
    )
  }

  const cfg = NIVEL_RIESGO[nivel as NivelRiesgo]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
