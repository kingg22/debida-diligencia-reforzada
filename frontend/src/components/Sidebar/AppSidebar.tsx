import {
  Briefcase,
  ClipboardList,
  FolderOpen,
  Home,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react"

import { SidebarAppearance } from "@/components/Common/Appearance"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar"
import useAuth from "@/hooks/useAuth"
import { type Item, Main } from "./Main"
import { User } from "./User"

const baseItems: Item[] = [{ icon: Home, title: "Inicio", path: "/" }]

const kycItems: Item[] = [
  { icon: ClipboardList, title: "Nuevo Cliente KYC", path: "/kyc/nuevo" },
  { icon: FolderOpen, title: "Clientes", path: "/clientes" },
]

const ddrItems: Item[] = [
  { icon: Briefcase, title: "Casos DDR", path: "/casos-ddr" },
]

const adminItems: Item[] = [
  { icon: Users, title: "Usuarios", path: "/admin" },
  { icon: Settings2, title: "Parámetros", path: "/parametros" },
]

function PanamaComplianceLogo() {
  return (
    <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: "rgba(201,168,76,0.15)",
          border: "1px solid rgba(201,168,76,0.30)",
        }}
      >
        <ShieldCheck size={16} style={{ color: "#c9a84c" }} />
      </div>
      <div className="group-data-[collapsible=icon]:hidden">
        <p
          className="text-sidebar-foreground text-sm font-semibold leading-none"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          PanamaCompliance
        </p>
        <p className="text-sidebar-foreground/60 mt-0.5 text-[10px]">SGDDR</p>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const { user } = useAuth()
  const role = user?.role

  const canKyc =
    role === "ADMIN" ||
    role === "ANALISTA_DDR" ||
    role === "OFICIAL_CUMPLIMIENTO"
  const canDdr =
    role === "ADMIN" ||
    role === "ANALISTA_DDR" ||
    role === "OFICIAL_CUMPLIMIENTO" ||
    role === "GERENTE_CUMPLIMIENTO" ||
    role === "COMITE_CUMPLIMIENTO"
  const isAdmin = role === "ADMIN"

  const items = [
    ...baseItems,
    ...(canKyc ? kycItems : []),
    ...(canDdr ? ddrItems : []),
    ...(isAdmin ? adminItems : []),
  ]

  const sidebarUser = user
    ? { full_name: user.full_name ?? user.email, email: user.email }
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
