import { useMutation } from "@tanstack/react-query"
import { useEffect } from "react"

import { AuthService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useAuth from "@/hooks/useAuth"
import useSessionCountdown from "@/hooks/useSessionCountdown"

const WARNING_THRESHOLD_SECONDS = 30

/** Eventos que cuentan como "el usuario está usando la web". No incluye
 * mousemove: mover el mouse sin interactuar no debe extender la sesión. */
const ACTIVITY_EVENTS = [
  "keydown",
  "mousedown",
  "touchstart",
  "scroll",
] as const

function SessionExpiryModal() {
  const { logout } = useAuth()
  const secsLeft = useSessionCountdown()
  const isWarning = secsLeft > 0 && secsLeft <= WARNING_THRESHOLD_SECONDS

  const extendMutation = useMutation({
    mutationFn: () => AuthService.extendSession(),
    onSuccess: (data) => {
      localStorage.setItem("access_token", data.access_token)
    },
  })

  useEffect(() => {
    if (!isWarning || extendMutation.isPending) return

    const handleActivity = () => extendMutation.mutate()

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true })
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity)
      }
    }
  }, [isWarning, extendMutation.isPending, extendMutation.mutate])

  if (!isWarning) return null

  return (
    <Dialog open={isWarning}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Tu sesión está por expirar</DialogTitle>
          <DialogDescription>
            Se va a cerrar la sesión por inactividad. ¿Deseas extenderla?
          </DialogDescription>
        </DialogHeader>

        <div className="text-primary py-2 text-center font-mono text-3xl font-semibold tabular-nums">
          {secsLeft}s
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={logout}>
            Cerrar sesión
          </Button>
          <Button
            onClick={() => extendMutation.mutate()}
            disabled={extendMutation.isPending}
          >
            Extender sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SessionExpiryModal
