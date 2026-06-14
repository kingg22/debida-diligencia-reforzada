import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { Clock, LogOut } from "lucide-react"
import { useEffect, useState } from "react"

import { Footer } from "@/components/Common/Footer"
import AppSidebar from "@/components/Sidebar/AppSidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { getTokenExpiry } from "@/lib/auth"
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
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono",
        isWarn && "animate-pulse-warn",
      )}
      style={{
        backgroundColor: isWarn
          ? "rgba(201,168,76,0.12)"
          : "rgba(201,168,76,0.07)",
        border: `1px solid ${isWarn ? "rgba(201,168,76,0.40)" : "rgba(201,168,76,0.18)"}`,
        color: isWarn ? "#c9a84c" : "#8a9bb5",
      }}
      title="Tiempo restante de sesión"
    >
      <Clock size={11} />
      <span>{timeStr}</span>
    </div>
  )
}

function Layout() {
  const { logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground" />
          <div className="flex-1" />
          <SessionTimer />
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
              "transition-colors hover:bg-red-500/10 hover:text-red-400",
            )}
            style={{ color: "#8a9bb5" }}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </header>
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

export default Layout
