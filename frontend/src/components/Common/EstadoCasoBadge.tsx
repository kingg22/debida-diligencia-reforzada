import {
  ESTADO_CASO,
  ESTADO_CLIENTE,
  ESTADO_KYC,
  type EstadoCaso,
  type EstadoCliente,
  type EstadoKYC,
} from "@/lib/sgddr"

// Badge de estado del caso DDR (lista y detalle de casos).
export function EstadoCasoBadge({ estado }: { estado?: string | null }) {
  const cfg =
    estado && estado in ESTADO_CASO ? ESTADO_CASO[estado as EstadoCaso] : null
  return <BadgePill cfg={cfg} fallback={estado} />
}

// Badge de estado del cliente (lista y detalle de clientes).
export function EstadoClienteBadge({ estado }: { estado?: string | null }) {
  const cfg =
    estado && estado in ESTADO_CLIENTE
      ? ESTADO_CLIENTE[estado as EstadoCliente]
      : null
  return <BadgePill cfg={cfg} fallback={estado} />
}

// Badge de estado del expediente KYC (compatibilidad con el modelo ExpedienteKYC).
export function EstadoKYCBadge({ estado }: { estado?: string | null }) {
  const cfg =
    estado && estado in ESTADO_KYC ? ESTADO_KYC[estado as EstadoKYC] : null
  return <BadgePill cfg={cfg} fallback={estado} />
}

function BadgePill({
  cfg,
  fallback,
}: {
  cfg: { label: string; color: string; bg: string } | null
  fallback?: string | null
}) {
  if (!cfg) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: "rgba(138,155,181,0.12)", color: "#8a9bb5" }}
      >
        {fallback || "—"}
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}
