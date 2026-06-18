import { useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"

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
import useAuth from "@/hooks/useAuth"

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
      throw redirect({
        to: "/",
      })
    }
  },
  head: () => ({
    meta: [
      {
        title: "Usuarios — PanamaCompliance SGDDR",
      },
    ],
  }),
})

function UsersTable() {
  const { user: currentUser } = useAuth()
  const { data, isPending, isError, error, refetch } = useQuery(
    getUsersQueryOptions(),
  )

  if (isPending) return <LoadingState label="Cargando usuarios…" />
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    )

  const rows: UserTableData[] = (data?.data ?? []).map((user: UserPublic) => ({
    ...user,
    isCurrentUser: currentUser?.id === user.id,
  }))

  if (rows.length === 0)
    return <EmptyState message="No hay usuarios registrados." />

  return <DataTable columns={columns} data={rows} />
}

function Admin() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        subtitle="Cuentas registradas y permisos del sistema."
        action={<AddUser />}
      />

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Listado de usuarios
        </p>
        <UsersTable />
      </div>
    </div>
  )
}
