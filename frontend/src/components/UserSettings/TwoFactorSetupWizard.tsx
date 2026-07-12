import { useMutation, useQueryClient } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  ShieldCheck,
} from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { AuthService, type TwoFactorSetupStartResponse } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const codeSchema = z.object({
  code: z
    .string()
    .length(6, "El código TOTP tiene exactamente 6 dígitos.")
    .regex(/^\d{6}$/, "Sólo dígitos."),
})
type CodeFormData = z.infer<typeof codeSchema>

type Step = "qr" | "verify" | "done"

interface TwoFactorSetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: () => void
}

export default function TwoFactorSetupWizard({
  open,
  onOpenChange,
  onCompleted,
}: TwoFactorSetupWizardProps) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("qr")
  const [setup, setSetup] = useState<TwoFactorSetupStartResponse | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedSecret, setCopiedSecret] = useState(false)
  const [savedCodes, setSavedCodes] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  })

  const startMutation = useMutation({
    mutationFn: () => AuthService.twofaActivateStart(),
    onSuccess: (data) => {
      setSetup(data)
      setStep("qr")
    },
    onError: handleError.bind(showErrorToast),
  })

  const confirmMutation = useMutation({
    mutationFn: (code: string) =>
      AuthService.twofaActivateConfirm({ requestBody: { code } }),
    onSuccess: (resp) => {
      setBackupCodes(resp.backup_codes)
      setStep("done")
      showSuccessToast("2FA activado correctamente")
      queryClient.invalidateQueries({ queryKey: ["twofa-status"] })
    },
    onError: (err: unknown) => {
      handleError.call(showErrorToast, err as any)
      reset()
    },
  })

  useEffect(() => {
    if (open && !setup && !startMutation.isPending) {
      setStep("qr")
      setBackupCodes([])
      setSavedCodes(false)
      reset()
      startMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSetup(null)
      setBackupCodes([])
      setSavedCodes(false)
      setStep("qr")
      reset()
      startMutation.reset()
      confirmMutation.reset()
    }
    onOpenChange(nextOpen)
  }

  const onSubmitCode = (data: CodeFormData) => {
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

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"))
      showSuccessToast("Códigos copiados al portapapeles")
    } catch {
      showErrorToast("No se pudo copiar")
    }
  }

  const finish = () => {
    if (!savedCodes) return
    handleOpenChange(false)
    onCompleted()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            Configurar autenticación de dos factores
          </DialogTitle>
          <DialogDescription>
            Refuerza la seguridad de tu cuenta con un código temporal además de
            la contraseña.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(["qr", "verify", "done"] as Step[]).map((s, i) => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all"
              style={{
                width:
                  step === s ? 36 : 18,
                backgroundColor:
                  (step === "qr" && i === 0) ||
                  (step === "verify" && i <= 1) ||
                  (step === "done" && i <= 2)
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
              }}
            />
          ))}
        </div>

        {startMutation.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>No se pudo iniciar la configuración. Intente de nuevo.</span>
          </div>
        )}

        {/* Step: QR */}
        {step === "qr" && (
          <div className="space-y-4">
            {startMutation.isPending && (
              <div className="flex flex-col items-center py-8">
                <Loader2 size={28} className="animate-spin text-primary" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Generando tu código QR…
                </p>
              </div>
            )}

            {setup && (
              <>
                <p className="text-sm text-muted-foreground">
                  Escanea este QR con{" "}
                  <strong className="text-foreground">
                    Google Authenticator
                  </strong>
                  , <strong className="text-foreground">Authy</strong> o
                  cualquier app compatible TOTP.
                </p>

                <div className="flex justify-center rounded-lg bg-muted/50 p-4">
                  <img
                    src={`data:image/png;base64,${setup.qr_png_base64}`}
                    alt="QR para configurar 2FA"
                    className="h-48 w-48"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                    O ingresa el secret manualmente
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground">
                      {setup.secret_base32}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copySecret}
                      className="shrink-0"
                    >
                      {copiedSecret ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedSecret ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                </div>

                <Button
                  onClick={() => setStep("verify")}
                  className="w-full"
                >
                  Ya escaneé el QR — Continuar
                </Button>
              </>
            )}
          </div>
        )}

        {/* Step: Verify code */}
        {step === "verify" && (
          <form onSubmit={handleSubmit(onSubmitCode)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ingresa el código de 6 dígitos que muestra tu app authenticator
              ahora mismo.
            </p>

            <div>
              <label
                htmlFor="twofa-code"
                className="mb-1.5 block text-sm text-muted-foreground"
              >
                Código de verificación
              </label>
              <input
                id="twofa-code"
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
                  "outline-none transition-all focus:ring-[3px] focus:ring-primary/18",
                  "disabled:opacity-50",
                  errors.code
                    ? "border-destructive focus:border-destructive"
                    : "border-border focus:border-primary",
                  "bg-background text-foreground",
                )}
              />
              {errors.code && (
                <p className="mt-1.5 text-xs text-destructive">
                  {errors.code.message}
                </p>
              )}
            </div>

            {confirmMutation.isError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {(confirmMutation.error as any)?.body?.detail ||
                    "Código inválido. Verifique la hora del dispositivo."}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("qr")}
                disabled={confirmMutation.isPending}
                className="flex-1"
              >
                Atrás
              </Button>
              <Button
                type="submit"
                disabled={confirmMutation.isPending}
                className="flex-1"
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Verificando…
                  </>
                ) : (
                  "Activar 2FA"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Step: Done — backup codes */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-500">
              <strong>Importante:</strong> guarda estos códigos en un lugar
              seguro. Sólo se muestran una vez. Si pierdes acceso a tu app
              authenticator, podrás usar uno de estos códigos para iniciar
              sesión.
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-4 font-mono text-sm">
              {backupCodes.map((code) => (
                <div key={code} className="text-center text-foreground">
                  {code}
                </div>
              ))}
            </div>

            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={savedCodes}
                onChange={(e) => setSavedCodes(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded accent-primary"
              />
              <span className="text-sm text-muted-foreground">
                Confirmo que he guardado los códigos de respaldo en un lugar
                seguro.
              </span>
            </label>

            <div className="flex gap-2">
              <Button variant="outline" onClick={copyCodes} className="flex-1">
                <Copy size={14} />
                Copiar códigos
              </Button>
              <Button
                disabled={!savedCodes}
                onClick={finish}
                className="flex-1"
              >
                <Check size={16} />
                Finalizar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
