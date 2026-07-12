import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, KeyRound, Loader2, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { AuthService } from "@/client"
import { getTempToken, isLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const schema = z.object({
  code: z
    .string()
    .min(6, "Ingresa los 6 dígitos del código o un código de respaldo.")
    .max(11, "Código demasiado largo."),
})
type FormData = z.infer<typeof schema>

export const Route = createFileRoute("/two-factor")({
  component: TwoFactor,
  beforeLoad: async () => {
    if (isLoggedIn()) throw redirect({ to: "/" })
    if (!getTempToken()) throw redirect({ to: "/login" })
  },
  head: () => ({
    meta: [{ title: "Verificación 2FA — PanamaCompliance SGDDR" }],
  }),
})

type Mode = "totp" | "backup"

function TwoFactor() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("totp")
  const [error, setError] = useState<string | null>(null)
  const tempToken = getTempToken() ?? ""

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  })

  const verifyMutation = useMutation({
    mutationFn: (code: string) =>
      AuthService.twofaVerify({ requestBody: { temp_token: tempToken, code } }),
    onSuccess: (resp) => {
      localStorage.setItem("access_token", resp.access_token)
      sessionStorage.removeItem("twofa_temp_token")
      navigate({ to: "/" })
    },
    onError: (err: unknown) => {
      setError(extractError(err))
      reset()
    },
  })

  const onSubmit = (data: FormData) => {
    setError(null)
    verifyMutation.mutate(data.code.trim())
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    reset()
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0a1628" }}
    >
      <div className="w-full max-w-md">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              backgroundColor: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.35)",
            }}
          >
            <ShieldCheck size={26} style={{ color: "#c9a84c" }} />
          </div>
          <h1
            className="mb-1.5 text-2xl"
            style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
          >
            Verificación en dos pasos
          </h1>
          <p className="text-sm" style={{ color: "#8a9bb5" }}>
            {mode === "totp"
              ? "Ingresa el código de 6 dígitos de tu app authenticator."
              : "Ingresa uno de los códigos de respaldo de 10 caracteres."}
          </p>
        </div>

        {/* ── Card ───────────────────────────────────────────────── */}
        <div
          className="rounded-xl p-6"
          style={{ backgroundColor: "#0f1f3a", border: "1px solid #1b2e4a" }}
        >
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-lg p-3"
              style={{
                backgroundColor: "rgba(224,82,82,0.10)",
                border: "1px solid rgba(224,82,82,0.35)",
              }}
            >
              <AlertTriangle
                size={16}
                className="mt-0.5 flex-shrink-0"
                style={{ color: "#e05252" }}
              />
              <p className="text-sm" style={{ color: "#e05252" }}>
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="mb-1.5 block text-sm"
                style={{ color: "#8a9bb5" }}
              >
                {mode === "totp" ? "Código TOTP" : "Código de respaldo"}
              </label>
              <input
                id="code"
                type="text"
                inputMode={mode === "totp" ? "numeric" : "text"}
                autoComplete="one-time-code"
                maxLength={mode === "totp" ? 6 : 11}
                placeholder={mode === "totp" ? "123456" : "ABCDE-FGHIJ"}
                disabled={verifyMutation.isPending}
                {...register("code")}
                onPaste={(e) => {
                  // Permitir pegar "123456" o "ABCDE-FGHIJ"
                  const text = e.clipboardData.getData("text")
                  if (text) {
                    e.preventDefault()
                    const cleaned = text.replace(/\s/g, "").toUpperCase()
                    const value =
                      mode === "totp"
                        ? cleaned.replace(/\D/g, "").slice(0, 6)
                        : cleaned.slice(0, 11)
                    ;(e.target as HTMLInputElement).value = value
                    register("code").onChange({
                      target: { name: "code", value },
                    } as React.ChangeEvent<HTMLInputElement>)
                  }
                }}
                className={cn(
                  "h-12 w-full rounded-lg border px-4 text-center text-lg tracking-[0.4em] font-mono",
                  "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
                  "disabled:opacity-50",
                  mode === "totp" ? "text-[#f0ede8]" : "text-[#f0ede8]",
                  errors.code
                    ? "border-[#e05252] focus:border-[#e05252]"
                    : "border-[#1b2e4a] focus:border-[#c9a84c]",
                )}
                style={{ backgroundColor: "#0a1628" }}
              />
              {errors.code && (
                <p className="mt-1.5 text-xs" style={{ color: "#e05252" }}>
                  {errors.code.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={verifyMutation.isPending}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
                "hover:brightness-110 active:scale-[0.99]",
                "disabled:cursor-not-allowed disabled:opacity-70",
              )}
              style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Verificando…
                </>
              ) : (
                "Verificar"
              )}
            </button>
          </form>

          {/* ── Switch mode ──────────────────────────────────────── */}
          <div
            className="mt-5 border-t pt-4"
            style={{ borderColor: "#1b2e4a" }}
          >
            {mode === "totp" ? (
              <button
                type="button"
                onClick={() => switchMode("backup")}
                className="flex w-full items-center justify-center gap-2 text-sm transition-colors hover:underline"
                style={{ color: "#c9a84c" }}
              >
                <KeyRound size={14} />
                Usar un código de respaldo
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode("totp")}
                className="flex w-full items-center justify-center gap-2 text-sm transition-colors hover:underline"
                style={{ color: "#c9a84c" }}
              >
                <KeyRound size={14} />
                Usar código de la app authenticator
              </button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs" style={{ color: "#4a6080" }}>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("twofa_temp_token")
              navigate({ to: "/login" })
            }}
            className="hover:underline"
            style={{ color: "#8a9bb5" }}
          >
            Volver a iniciar sesión
          </button>
        </p>
      </div>
    </div>
  )
}

function extractError(err: unknown): string {
  if (!err) return "Verificación fallida."
  const anyErr = err as { body?: { detail?: string }; message?: string }
  if (anyErr.body?.detail) return anyErr.body.detail
  if (anyErr.message) return anyErr.message
  return "Verificación fallida."
}
