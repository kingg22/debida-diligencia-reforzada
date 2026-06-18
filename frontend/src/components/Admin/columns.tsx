import type { ColumnDef } from "@tanstack/react-table"

import type { UserPublic } from "@/client"
import { formatFecha, ROL_LABELS, type Rol } from "@/lib/sgddr"
import { cn } from "@/lib/utils"
import { UserActionsMenu } from "./UserActionsMenu"

export type UserTableData = UserPublic & {
  isCurrentUser: boolean
}

// Tonos por rol para el badge de la tabla. Usamos Tailwind con la
// variante `dark:` para que el contraste se mantenga correcto en
// ambos temas (los RGBA fijos se ven mal en light mode).
function roleToneClasses(role: Rol | null, isSuperuser: boolean): string {
  if (role === "ADMIN" || isSuperuser) {
    return "bg-amber-500/15 text-amber-700 dark:text-amber-400"
  }
  if (role === "OFICIAL_CUMPLIMIENTO" || role === "GERENTE_CUMPLIMIENTO") {
    return "bg-blue-500/15 text-blue-700 dark:text-blue-400"
  }
  if (role === "COMITE_CUMPLIMIENTO") {
    return "bg-purple-500/15 text-purple-700 dark:text-purple-400"
  }
  if (role === "AUDITOR") {
    return "bg-slate-500/15 text-slate-700 dark:text-slate-400"
  }
  // ANALISTA_DDR o sin rol
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
}

const baseBadge =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"

export const columns: ColumnDef<UserTableData>[] = [
  {
    accessorKey: "full_name",
    header: "Nombre completo",
    cell: ({ row }) => {
      const fullName = row.original.full_name
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn("font-medium", !fullName && "text-muted-foreground")}
          >
            {fullName || "N/A"}
          </span>
          {row.original.isCurrentUser && (
            <span className="border-primary/30 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
              Tú
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "email",
    header: "Correo",
    cell: ({ row }) => (
      <span className="text-muted-foreground font-mono text-xs">
        {row.original.email}
      </span>
    ),
  },
  {
    accessorKey: "role",
    header: "Rol",
    cell: ({ row }) => {
      // UserPublic.role es opcional en el schema; si el backend aún no
      // lo devuelve (cliente generado viejo), caemos al heurístico
      // is_superuser para no romper la UI.
      const role = (row.original.role ?? null) as Rol | null
      const label = role
        ? ROL_LABELS[role]
        : row.original.is_superuser
          ? "Administrador"
          : "Sin rol"
      return (
        <span
          className={cn(
            baseBadge,
            roleToneClasses(role, !!row.original.is_superuser),
          )}
        >
          {label}
        </span>
      )
    },
  },
  {
    accessorKey: "is_active",
    header: "Estado",
    cell: ({ row }) => {
      const active = !!row.original.is_active
      return (
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              active ? "bg-emerald-500" : "bg-slate-400",
            )}
          />
          <span className={active ? "" : "text-muted-foreground"}>
            {active ? "Activo" : "Inactivo"}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Registro",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.original.created_at ? formatFecha(row.original.created_at) : "—"}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Acciones</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <UserActionsMenu user={row.original} />
      </div>
    ),
  },
]
