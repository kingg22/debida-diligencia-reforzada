import { Check, X } from "lucide-react"

const REQS = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Al menos 1 mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Al menos 1 minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Al menos 1 número", test: (p: string) => /\d/.test(p) },
  {
    label: "Al menos 1 carácter especial",
    test: (p: string) => /[^A-Za-z0-9]/.test(p),
  },
]

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="space-y-1.5">
      {REQS.map((r) => {
        const met = r.test(password)
        return (
          <li key={r.label} className="flex items-center gap-2 text-sm">
            {met ? (
              <Check
                size={13}
                className="flex-shrink-0"
                style={{ color: "#22c55e" }}
              />
            ) : (
              <X
                size={13}
                className="flex-shrink-0"
                style={{ color: "#4a6080" }}
              />
            )}
            <span style={{ color: met ? "#22c55e" : "#8a9bb5" }}>
              {r.label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function passwordIsValid(password: string): boolean {
  return REQS.every((r) => r.test(password))
}
