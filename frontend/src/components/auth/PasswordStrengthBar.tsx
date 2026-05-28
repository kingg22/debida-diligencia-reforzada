const LEVELS = [
  { label: "Muy débil", color: "#e05252", pct: 20 },
  { label: "Débil", color: "#d97706", pct: 40 },
  { label: "Aceptable", color: "#eab308", pct: 60 },
  { label: "Fuerte", color: "#86efac", pct: 80 },
  { label: "Muy fuerte", color: "#22c55e", pct: 100 },
]

function score(pw: string): number {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

export function PasswordStrengthBar({ password }: { password: string }) {
  if (!password) return null
  const lvl = LEVELS[Math.max(0, score(password) - 1)]
  return (
    <div className="space-y-1.5">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: "#1b2e4a" }}
      >
        <div
          className="strength-fill h-full rounded-full"
          style={{ width: `${lvl.pct}%`, backgroundColor: lvl.color }}
        />
      </div>
      <p className="text-xs font-medium" style={{ color: lvl.color }}>
        {lvl.label}
      </p>
    </div>
  )
}
