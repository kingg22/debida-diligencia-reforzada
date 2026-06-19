import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react"
import { useState } from "react"

import { AuthService, type TwoFactorStatus } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LoadingButton } from "@/components/ui/loading-button"
import { PasswordInput } from "@/components/ui/password-input"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"

const TwoFactorSettings = () => {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["twofa-status"],
    queryFn: AuthService.twofaStatus,
  })

  const [disableOpen, setDisableOpen] = useState(false)
  const [regenOpen, setRegenOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["twofa-status"] })
    setPassword("")
  }

  const disableMutation = useMutation({
    mutationFn: () => AuthService.twofaDisable({ requestBody: { password } }),
    onSuccess: () => {
      showSuccessToast("2FA desactivado")
      setDisableOpen(false)
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const regenMutation = useMutation({
    mutationFn: () =>
      AuthService.twofaRegenerateBackupCodes({ requestBody: { password } }),
    onSuccess: (resp) => {
      setNewCodes(resp.backup_codes)
      showSuccessToast("Códigos de respaldo regenerados")
      setRegenOpen(false)
      invalidate()
    },
    onError: handleError.bind(showErrorToast),
  })

  const closeNewCodes = () => setNewCodes(null)

  const copyCodes = async () => {
    if (!newCodes) return
    try {
      await navigator.clipboard.writeText(newCodes.join("\n"))
      showSuccessToast("Códigos copiados al portapapeles")
    } catch {
      showErrorToast("No se pudo copiar")
    }
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm">Cargando estado de 2FA…</span>
      </div>
    )
  }

  const canDisable = data.enabled && !data.required_by_role

  return (
    <div className="max-w-2xl space-y-6 py-2">
      <div>
        <h3 className="text-lg font-semibold">Autenticación de dos factores</h3>
        <p className="text-muted-foreground text-sm">
          Refuerza la seguridad de tu cuenta con un código temporal además de la contraseña.
        </p>
      </div>

      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          data.enabled
            ? "border-emerald-500/30 bg-emerald-500/5"
            : data.required_by_role
              ? "border-amber-500/30 bg-amber-500/5"
              : "border-border bg-muted/30",
        )}
      >
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
            data.enabled
              ? "bg-emerald-500/15 text-emerald-500"
              : data.required_by_role
                ? "bg-amber-500/15 text-amber-500"
                : "bg-muted text-muted-foreground",
          )}
        >
          {data.enabled ? (
            <ShieldCheck size={18} />
          ) : (
            <ShieldOff size={18} />
          )}
        </div>

        <div className="flex-1">
          <p className="text-sm font-medium">
            {data.enabled ? "2FA activado" : "2FA desactivado"}
            {data.required_by_role && (
              <span className="text-amber-500"> (obligatorio para tu rol)</span>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {data.enabled
              ? `Códigos de respaldo restantes: ${data.backup_codes_remaining}`
              : data.required_by_role
                ? "Debes configurar 2FA para acceder a las funciones del sistema."
                : "Actívalo para añadir una capa extra de seguridad."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {data.enabled && (
          <>
            <Button
              variant="outline"
              onClick={() => setRegenOpen(true)}
              size="sm"
            >
              <RefreshCw size={14} />
              Regenerar códigos de respaldo
            </Button>
            {canDisable && (
              <Button
                variant="outline"
                onClick={() => setDisableOpen(true)}
                size="sm"
                className="text-red-500 hover:text-red-500"
              >
                <ShieldOff size={14} />
                Desactivar 2FA
              </Button>
            )}
          </>
        )}
        {!data.enabled && (
          <Button asChild size="sm" disabled={data.required_by_role}>
            <a href="/two-factor/setup">
              <KeyRound size={14} />
              Activar 2FA
            </a>
          </Button>
        )}
      </div>

      {/* ── Modal: desactivar ────────────────────────────── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar 2FA</DialogTitle>
            <DialogDescription>
              Ingresa tu contraseña para confirmar. Tu cuenta será menos segura.
            </DialogDescription>
          </DialogHeader>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña actual"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              variant="destructive"
              loading={disableMutation.isPending}
              onClick={() => disableMutation.mutate()}
              disabled={!password}
            >
              Desactivar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: regenerar backup codes ──────────────── */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerar códigos de respaldo</DialogTitle>
            <DialogDescription>
              Esto invalida los códigos anteriores. Ingresa tu contraseña para continuar.
            </DialogDescription>
          </DialogHeader>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña actual"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              Cancelar
            </Button>
            <LoadingButton
              loading={regenMutation.isPending}
              onClick={() => regenMutation.mutate()}
              disabled={!password}
            >
              Regenerar
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: mostrar nuevos códigos ──────────────── */}
      <Dialog open={newCodes !== null} onOpenChange={(o) => !o && closeNewCodes()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevos códigos de respaldo</DialogTitle>
            <DialogDescription>
              Guárdalos en un lugar seguro. Sólo se muestran una vez.
            </DialogDescription>
          </DialogHeader>
          {newCodes && (
            <div
              className="grid grid-cols-2 gap-2 rounded-lg border p-4 font-mono text-sm"
            >
              {newCodes.map((code) => (
                <div key={code} className="text-center">
                  {code}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyCodes}>
              <Copy size={14} />
              Copiar
            </Button>
            <Button onClick={closeNewCodes}>
              <CheckCircle2 size={14} />
              Ya los guardé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TwoFactorSettings
