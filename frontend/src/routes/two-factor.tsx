import {
  createFileRoute,
  Link as RouterLink,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { OTPInput } from "@/components/auth/OTPInput"
import { completeLogin, type Role } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const DEMO_CODE = "123456"
const VALIDITY_SECS = 30

export const Route = createFileRoute("/two-factor")({
  component: TwoFactor,
  beforeLoad: async () => {
    if (!sessionStorage.getItem("pre_auth")) {
      throw redirect({ to: "/login" })
    }
  },
  head: () => ({
    meta: [{ title: "Verificación 2FA — PanamaCompliance SGDDR" }],
  }),
})

function TwoFactor() {
  const navigate = useNavigate()
  const [countdown, setCountdown] = useState(VALIDITY_SECS)
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [otpError, setOtpError] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [failCount, setFailCount] = useState(0)
  const [currentCode, setCurrentCode] = useState("")

  /* countdown timer */
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setExpired(true)
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const verify = useCallback(
    async (code: string) => {
      if (expired || loading) return
      setLoading(true)
      await new Promise((r) => setTimeout(r, 700))

      if (code === DEMO_CODE) {
        const raw = sessionStorage.getItem("pre_auth")
        if (raw) {
          const { email, role, name } = JSON.parse(raw) as {
            email: string
            role: Role
            name: string
          }
          sessionStorage.removeItem("pre_auth")
          completeLogin(role, name, email)
          navigate({ to: "/" })
        }
      } else {
        const next = failCount + 1
        setFailCount(next)
        setOtpError(true)
        setLoading(false)

        if (next >= 3) {
          sessionStorage.removeItem("pre_auth")
          toast.error(
            "Demasiados intentos fallidos. Debes volver a iniciar sesión.",
          )
          navigate({ to: "/login" })
          return
        }

        setErrorMsg("Código incorrecto. Inténtalo nuevamente.")
        setTimeout(() => {
          setOtpError(false)
          setErrorMsg(null)
        }, 550)
      }
    },
    [expired, loading, failCount, navigate],
  )

  const handleResend = () => {
    setCountdown(VALIDITY_SECS)
    setExpired(false)
    setErrorMsg(null)
    setOtpError(false)
    setFailCount(0)
    setCurrentCode("")
  }

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`
  const circumference = 2 * Math.PI * 20
  const strokeOffset = circumference * (1 - countdown / VALIDITY_SECS)

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "#040d1c" }}
    >
      <div className="w-full max-w-md">
        <RouterLink
          to="/login"
          className="mb-10 inline-flex items-center gap-2 text-sm transition-colors hover:text-[#c9a84c]"
          style={{ color: "#8a9bb5" }}
        >
          <ArrowLeft size={15} /> Volver al inicio
        </RouterLink>

        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              backgroundColor: "#0f1f3a",
              border: "2px solid #1b2e4a",
            }}
          >
            <ShieldCheck size={36} style={{ color: "#c9a84c" }} />
          </div>
          <h1
            className="mb-3 text-[30px]"
            style={{
              fontFamily: "DM Serif Display, serif",
              color: "#f0ede8",
            }}
          >
            Verificación de identidad
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#8a9bb5" }}>
            Ingresa el código de 6 dígitos enviado
            <br />
            al autenticador registrado en tu cuenta
          </p>
        </div>

        {/* OTP inputs */}
        <div className="mb-8 flex justify-center">
          <OTPInput
            length={6}
            onComplete={(code) => {
              setCurrentCode(code)
              verify(code)
            }}
            error={otpError}
            disabled={expired || loading}
          />
        </div>

        {/* Error message */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-5 flex items-center justify-center gap-2 rounded-lg p-3"
            style={{
              backgroundColor: "rgba(224,82,82,0.10)",
              border: "1px solid rgba(224,82,82,0.30)",
            }}
          >
            <p className="text-sm" style={{ color: "#e05252" }}>
              {errorMsg}
            </p>
          </div>
        )}

        {/* Ring countdown */}
        <div className="mb-6 flex flex-col items-center gap-2">
          {!expired ? (
            <div className="relative h-16 w-16">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#1b2e4a"
                  strokeWidth="3"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#c9a84c"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-xs font-mono"
                style={{ color: "#f0ede8" }}
              >
                {timeStr}
              </span>
            </div>
          ) : null}
          <p className="text-xs" style={{ color: "#4a6080" }}>
            {expired
              ? "El código ha expirado."
              : `Código válido por ${timeStr}`}
          </p>
        </div>

        {/* Verify button */}
        <button
          type="button"
          disabled={expired || loading}
          onClick={() => currentCode.length === 6 && verify(currentCode)}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-lg",
            "text-sm font-semibold transition-all",
            "hover:brightness-110 active:scale-[0.99]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Verificando…
            </>
          ) : (
            "Verificar"
          )}
        </button>

        {/* Resend link */}
        <p className="mt-4 text-center text-sm">
          {expired ? (
            <button
              type="button"
              onClick={handleResend}
              className="underline transition-colors hover:text-[#e8c97a]"
              style={{ color: "#c9a84c" }}
            >
              Reenviar código
            </button>
          ) : (
            <span style={{ color: "#4a6080" }}>
              Reenviar código (disponible en {timeStr})
            </span>
          )}
        </p>

        <p className="mt-8 text-center text-xs" style={{ color: "#4a6080" }}>
          Demo: usa el código{" "}
          <span className="font-mono" style={{ color: "#8a9bb5" }}>
            123456
          </span>
        </p>
      </div>
    </div>
  )
}
