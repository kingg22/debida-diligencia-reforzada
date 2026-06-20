import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Search, X } from "lucide-react"
import { useMemo, useState } from "react"

import { type UserPublic, UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { columns, type UserTableData } from "@/components/Admin/columns"
import { PageHeader } from "@/components/Common/PageHeader"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { DataTable } from "@/components/Common/DataTable"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useAuth from "@/hooks/useAuth"
import { ROL_LABELS, type Rol } from "@/lib/sgddr"

const ROLES: Rol[] = [
  "ADMIN",
  "OFICIAL_CUMPLIMIENTO",
  "ANALISTA_DDR",
  "GERENTE_CUMPLIMIENTO",
  "COMITE_CUMPLIMIENTO",
  "AUDITOR",
]

function getUsersQueryOptions() {
  return {
    queryFn: () => UsersService.readUsers({ skip: 0, limit: 100 }),
    queryKey: ["users"],
  }
}

export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  beforeLoad: async () => {
    const user = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Usuarios — PanamaCompliance SGDDR" }],
  }),
})

function UsersTable() {
  const { user: currentUser } = useAuth()
  const { data, isPending, isError, error, refetch } = useQuery(
    getUsersQueryOptions(),
  )

  const [search, setSearch] = useState("")
  const [rolFilter, setRolFilter] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("")

  const allRows: UserTableData[] = useMemo(
    () =>
      (data?.data ?? []).map((user: UserPublic) => ({
        ...user,
        isCurrentUser: currentUser?.id === user.id,
      })),
    [data, currentUser],
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allRows.filter((row) => {
      if (q) {
        const nombre = (row.full_name ?? "").toLowerCase()
        const email = row.email.toLowerCase()
        if (!nombre.includes(q) && !email.includes(q)) return false
      }
      if (rolFilter && row.role !== rolFilter) return false
      if (estadoFilter === "activo" && !row.is_active) return false
      if (estadoFilter === "inactivo" && row.is_active) return false
      return true
    })
  }, [allRows, search, rolFilter, estadoFilter])

  const hayFiltros = !!(search || rolFilter || estadoFilter)

  if (isPending) return <LoadingState label="Cargando usuarios…" />
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={15}
            className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"
          />
          <Input
            placeholder="Buscar por nombre o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value)}
          className="border-input bg-background text-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none"
        >
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABELS[r]}
            </option>
          ))}
        </select>

        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="border-input bg-background text-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>

        {hayFiltros && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("")
              setRolFilter("")
              setEstadoFilter("")
            }}
          >
            <X size={13} /> Limpiar
          </Button>
        )}
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          message={
            hayFiltros
              ? "No hay usuarios que coincidan con los filtros."
              : "No hay usuarios registrados."
          }
        />
      ) : (
        <DataTable columns={columns} data={filteredRows} />
      )}
    </div>
  )
}

function Admin() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas registradas y permisos del sistema."
        action={<AddUser />}
      />

      <div className="bg-card overflow-hidden rounded-xl border">
        <p className="text-muted-foreground border-b px-5 py-4 text-xs font-semibold tracking-wider uppercase">
          Listado de usuarios
        </p>
        <div className="p-5">
          <UsersTable />
        </div>
      </div>
    </div>
  )
}
