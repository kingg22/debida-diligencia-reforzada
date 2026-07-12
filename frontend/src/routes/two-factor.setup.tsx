import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Check, Copy, Loader2, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AuthService, type TwoFactorSetupStartResponse } from "@/client"
import { getTempToken, isLoggedIn } from "@/hooks/useAuth"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"

const codeSchema = z.object({
  code: z
    .string()
    .length(6, "El código TOTP tiene exactamente 6 dígitos.")
    .regex(/^\d{6}$/, "Sólo dígitos."),
})
type CodeFormData = z.infer<typeof codeSchema>

type Step = 1 | 2 | 3

export const Route = createFileRoute("/two-factor/setup")({
  component: TwoFactorSetup,
  beforeLoad: async () => {
    if (isLoggedIn()) throw redirect({ to: "/" })
    if (!getTempToken()) throw redirect({ to: "/login" })
  },
  head: () => ({
    meta: [{ title: "Configurar 2FA — PanamaCompliance SGDDR" }],
  }),
})

function TwoFactorSetup() {
  const navigate = useNavigate()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [step, setStep] = useState<Step>(1)
  const [setup, setSetup] = useState<TwoFactorSetupStartResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [savedCodes, setSavedCodes] = useState(false)

  const tempToken = getTempToken() ?? ""

  // ── Step 1: pedir QR + secret
  const startMutation = useMutation({
    mutationFn: () =>
      AuthService.twofaSetupStart({
        requestBody: { temp_token: tempToken, code: "000000" },
      }),
    onSuccess: (data) => {
      setSetup(data)
      setStep(2)
    },
    onError: (err: unknown) => {
      setError(extractError(err))
    },
  })

  // Auto-arrancar el setup al montar
  useEffect(() => {
    if (!setup && !startMutation.isPending && !startMutation.isError) {
      startMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    startMutation.mutate,
    startMutation.isPending,
    startMutation.isError,
    setup,
  ])

  // ── Step 2: confirmar con código TOTP
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  const confirmMutation = useMutation({
    mutationFn: (code: string) =>
      AuthService.twofaSetupConfirm({
        requestBody: { temp_token: tempToken, code },
      }),
    onSuccess: (resp) => {
      localStorage.setItem("access_token", resp.access_token)
      sessionStorage.removeItem("twofa_temp_token")
      setBackupCodes(resp.backup_codes)
      setStep(3)
      showSuccessToast("2FA activado correctamente")
    },
    onError: (err: unknown) => {
      setError(extractError(err))
      reset()
    },
  })

  const onSubmitCode = (data: CodeFormData) => {
    setError(null)
    confirmMutation.mutate(data.code)
  }

  const copySecret = async () => {
    if (!setup) return
    try {
      await navigator.clipboard.writeText(setup.secret_base32)
      setCopiedSecret(true)
      setTimeout(() => setCopiedSecret(false), 2000)
    } catch {
      showErrorToast("No se pudo copiar al portapapeles")
    }
  }

  const finish = () => {
    if (!savedCodes) return
    navigate({ to: "/" })
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#0a1628" }}
    >
      <div className="w-full max-w-lg">
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
            Configura tu 2FA
          </h1>
          <p className="text-sm" style={{ color: "#8a9bb5" }}>
            Paso {step} de 3 — Tu rol requiere autenticación de dos factores.
          </p>
        </div>

        {/* ── Step indicator ────────────────────────────────────── */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: step === s ? 36 : 18,
                backgroundColor: step >= s ? "#c9a84c" : "#1b2e4a",
              }}
            />
          ))}
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

          {/* ── Step 1: QR + secret ────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              {startMutation.isPending && (
                <div className="flex flex-col items-center py-8">
                  <Loader2
                    size={28}
                    className="animate-spin"
                    style={{ color: "#c9a84c" }}
                  />
                  <p className="mt-3 text-sm" style={{ color: "#8a9bb5" }}>
                    Generando tu código QR…
                  </p>
                </div>
              )}

              {setup && (
                <>
                  <p
                    className="text-sm leading-relaxed"
                    style={{ color: "#8a9bb5" }}
                  >
                    Escanea este QR con{" "}
                    <strong style={{ color: "#f0ede8" }}>
                      Google Authenticator
                    </strong>
                    , <strong style={{ color: "#f0ede8" }}>Authy</strong> o
                    cualquier app compatible TOTP.
                  </p>

                  <div
                    className="flex justify-center rounded-lg p-4"
                    style={{ backgroundColor: "#f0ede8" }}
                  >
                    <img
                      src={`data:image/png;base64,${setup.qr_png_base64}`}
                      alt="QR para configurar 2FA"
                      className="h-48 w-48"
                    />
                  </div>

                  <div>
                    <label
                      className="mb-1.5 block text-xs uppercase tracking-wider"
                      style={{ color: "#4a6080" }}
                    >
                      O ingresa el secret manualmente
                    </label>
                    <div className="flex gap-2">
                      <code
                        className="flex-1 overflow-x-auto rounded-lg border px-3 py-2 font-mono text-sm"
                        style={{
                          backgroundColor: "#0a1628",
                          borderColor: "#1b2e4a",
                          color: "#f0ede8",
                        }}
                      >
                        {setup.secret_base32}
                      </code>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="flex h-auto items-center gap-1.5 rounded-lg px-3 text-sm transition-colors"
                        style={{
                          backgroundColor: copiedSecret
                            ? "rgba(74,222,128,0.10)"
                            : "#1b2e4a",
                          color: copiedSecret ? "#4ade80" : "#c9a84c",
                          border: `1px solid ${copiedSecret ? "rgba(74,222,128,0.35)" : "#1b2e4a"}`,
                        }}
                      >
                        {copiedSecret ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}
                        {copiedSecret ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                    style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
                  >
                    Ya escaneé el QR — Continuar
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 2: confirmar código ──────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit(onSubmitCode)} className="space-y-4">
              <p
                className="text-sm leading-relaxed"
                style={{ color: "#8a9bb5" }}
              >
                Ingresa el código de 6 dígitos que muestra tu app authenticator
                ahora mismo.
              </p>

              <div>
                <label
                  htmlFor="code"
                  className="mb-1.5 block text-sm"
                  style={{ color: "#8a9bb5" }}
                >
                  Código de verificación
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  disabled={confirmMutation.isPending}
                  {...register("code")}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text")
                    if (text) {
                      e.preventDefault()
                      const value = text.replace(/\D/g, "").slice(0, 6)
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
                    "text-[#f0ede8]",
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

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={confirmMutation.isPending}
                  className="h-11 flex-1 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: "transparent",
                    color: "#8a9bb5",
                    border: "1px solid #1b2e4a",
                  }}
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={confirmMutation.isPending}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-70"
                  style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Verificando…
                    </>
                  ) : (
                    "Activar 2FA"
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: backup codes ──────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div
                className="rounded-lg p-3"
                style={{
                  backgroundColor: "rgba(217,119,6,0.10)",
                  border: "1px solid rgba(217,119,6,0.35)",
                }}
              >
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "#d97706" }}
                >
                  <strong>Importante:</strong> guarda estos códigos en un lugar
                  seguro. Sólo se muestran una vez. Si pierdes acceso a tu app
                  authenticator, podrás usar uno de estos códigos para iniciar
                  sesión.
                </p>
              </div>

              <div
                className="grid grid-cols-2 gap-2 rounded-lg p-4 font-mono text-sm"
                style={{
                  backgroundColor: "#0a1628",
                  border: "1px solid #1b2e4a",
                }}
              >
                {backupCodes.map((code) => (
                  <div
                    key={code}
                    className="text-center"
                    style={{ color: "#f0ede8" }}
                  >
                    {code}
                  </div>
                ))}
              </div>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={savedCodes}
                  onChange={(e) => setSavedCodes(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[#c9a84c]"
                />
                <span className="text-sm" style={{ color: "#8a9bb5" }}>
                  Confirmo que he guardado los códigos de respaldo en un lugar
                  seguro.
                </span>
              </label>

              <button
                type="button"
                disabled={!savedCodes}
                onClick={finish}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
              >
                <Check size={16} />
                Finalizar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function extractError(err: unknown): string {
  if (!err) return "Operación fallida."
  const anyErr = err as { body?: { detail?: string }; message?: string }
  if (anyErr.body?.detail) return anyErr.body.detail
  if (anyErr.message) return anyErr.message
  return "Operación fallida."
}
