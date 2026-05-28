import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import { Lock, Mail } from "lucide-react"

export const Route = createFileRoute("/account-locked")({
  component: AccountLocked,
  head: () => ({
    meta: [{ title: "Cuenta Bloqueada — PanamaCompliance SGDDR" }],
  }),
})

function AccountLocked() {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "#040d1c" }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Lock icon */}
        <div
          className="mx-auto mb-8 flex h-24 w-24 animate-lock-bounce items-center justify-center rounded-full"
          style={{
            backgroundColor: "#0f1f3a",
            border: "2px solid rgba(224,82,82,0.35)",
          }}
        >
          <Lock size={40} style={{ color: "#e05252" }} />
        </div>

        <h1
          className="mb-4 text-[28px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Cuenta bloqueada
        </h1>

        <p
          className="mb-8 text-sm leading-relaxed"
          style={{ color: "#8a9bb5" }}
        >
          Tu cuenta ha sido bloqueada temporalmente por seguridad
          <br />
          tras múltiples intentos fallidos de inicio de sesión.
        </p>

        {/* Steps card */}
        <div
          className="mb-8 rounded-xl p-5 text-left"
          style={{
            backgroundColor: "#0f1f3a",
            border: "1px solid rgba(201,168,76,0.25)",
          }}
        >
          <p
            className="mb-4 text-sm font-semibold"
            style={{ color: "#f0ede8" }}
          >
            Pasos para desbloquear tu acceso:
          </p>
          <ol className="space-y-3">
            {[
              "Contacta al Administrador del sistema",
              "Verifica tu identidad ante el Administrador",
              "El Administrador desbloqueará tu cuenta",
            ].map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm"
                style={{ color: "#8a9bb5" }}
              >
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ backgroundColor: "#1b2e4a", color: "#c9a84c" }}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Contact button */}
        <a
          href="mailto:admin@panama.com"
          className="inline-flex items-center gap-2 rounded-lg border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-[#1b2e4a]"
          style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
        >
          <Mail size={15} />
          Contactar Administrador
        </a>

        <div className="mt-6">
          <RouterLink
            to="/login"
            className="text-sm transition-colors hover:text-[#c9a84c]"
            style={{ color: "#4a6080" }}
          >
            ← Volver al inicio de sesión
          </RouterLink>
        </div>

        <p className="mt-8 text-xs" style={{ color: "#4a6080" }}>
          Ref. Ley 254/2021, Art. 14 — Controles de acceso a sistemas
          financieros
        </p>
      </div>
    </div>
  )
}
