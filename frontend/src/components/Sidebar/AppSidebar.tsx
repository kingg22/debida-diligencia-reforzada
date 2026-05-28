import { Home, Users, ShieldCheck } from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { getCurrentUser } from "@/lib/mock-data"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [
  { icon: Home, title: "Inicio", path: "/" },
]

const adminItems: Item[] = [
  { icon: Users, title: "Usuarios", path: "/usuarios" },
]

function PanamaComplianceLogo() {
  return (
    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.30)" }}
      >
        <ShieldCheck size={16} style={{ color: "#c9a84c" }} />
      </div>
      <div className="group-data-[collapsible=icon]:hidden">
        <p
          className="text-sm font-semibold leading-none"
          style={{ color: "#f0ede8", fontFamily: "DM Serif Display, serif" }}
        >
          PanamaCompliance
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: "#4a6080" }}>
          SGDDR
        </p>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const currentUser = getCurrentUser()

  const items =
    currentUser?.role === "ADMIN"
      ? [...baseItems, ...adminItems]
      : baseItems

  const sidebarUser = currentUser
    ? { full_name: currentUser.name, email: currentUser.email }
    : null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-5">
        <PanamaComplianceLogo />
      </SidebarHeader>
      <SidebarContent>
        <Main items={items} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarAppearance />
        <User user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
