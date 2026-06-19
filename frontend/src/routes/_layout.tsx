import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Clock, KeyRound, LogOut, X } from "lucide-react"
import { useEffect, useState } from "react"

import { AuthService, type TwoFactorStatus } from "@/client"
import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import { Button } from "@/components/ui/button"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { getTokenExpiry } from "@/lib/auth"
import { roleRequires2FA } from "@/lib/roles"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({ to: "/login" })
    }
  },
})

function SessionTimer() {
  const { logout } = useAuth()
  const [secsLeft, setSecsLeft] = useState(() => {
    const exp = getTokenExpiry()
    if (!exp) return 0
    return Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000))
  })

  useEffect(() => {
    const id = setInterval(() => {
      const exp = getTokenExpiry()
      if (!exp) {
        setSecsLeft(0)
        return
      }
      const s = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000))
      setSecsLeft(s)
      if (s <= 0) {
        clearInterval(id)
        logout()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [logout])

  if (secsLeft <= 0) return null

  const h = Math.floor(secsLeft / 3600)
  const m = Math.floor((secsLeft % 3600) / 60)
  const s = secsLeft % 60
  const timeStr =
    h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`

  const isWarn = secsLeft <= 900

  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs",
        isWarn
          ? "border-primary/40 bg-primary/15 text-primary animate-pulse-warn"
          : "border-primary/20 bg-primary/10",
        isWarn && "text-primary",
      )}
      title="Tiempo restante de sesión"
    >
      <Clock size={11} />
      <span>{timeStr}</span>
    </div>
  )
}

function Layout() {
  const { logout } = useAuth()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="flex-1" />
          <SessionTimer />
          <button
            onClick={logout}
            className={cn(
              "text-muted-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              "transition-colors hover:bg-red-500/10 hover:text-red-500",
            )}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </header>
        <TwoFactorBanner />
        <main className="flex-1 p-6 md:p-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
        <Footer />
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Banner persistente para usuarios cuyo rol requiere 2FA pero no lo han
 * configurado. Aparece debajo del header, encima del contenido, hasta que
 * activen 2FA. Se descarta (oculta) por sesión con la X.
 */
function TwoFactorBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  const showBanner = roleRequires2FA(user?.role)

  const { data } = useQuery<TwoFactorStatus>({
    queryKey: ["twofa-status"],
    queryFn: AuthService.twofaStatus,
    enabled: showBanner,
    // No reintentar agresivamente: el endpoint puede 403 transitoriamente
    // mientras se inicializa la sesión.
    retry: 1,
  })

  if (!showBanner) return null
  if (dismissed) return null
  if (data?.enabled) return null
  // Mientras carga o si 403 (todavía no inicializó), no mostrar nada para
  // evitar parpadeos. La X es para "ahora no", no para siempre.
  if (!data) return null

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b px-4 py-2.5"
      style={{
        backgroundColor: "rgba(217,119,6,0.08)",
        borderColor: "rgba(217,119,6,0.30)",
        color: "#d97706",
      }}
    >
      <KeyRound size={16} className="flex-shrink-0" />
      <p className="flex-1 text-sm">
        Tu rol requiere autenticación de dos factores. Configúrala para acceder
        a todas las funciones del sistema.
      </p>
      <Button asChild size="sm" variant="outline" className="h-7">
        <a href="/two-factor/setup">Configurar ahora</a>
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Cerrar aviso"
        className="rounded p-1 transition-colors hover:bg-amber-500/15"
        style={{ color: "#d97706" }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default Layout
