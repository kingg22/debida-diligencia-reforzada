import { ROLE_BADGE, ROLE_LABELS, type Role } from "@/lib/roles"

// Badge de rol del usuario en sesión, usado en el pie del sidebar.
export function RoleBadge({ role }: { role?: string | null }) {
  if (!role || !(role in ROLE_LABELS)) return null

  const cfg = ROLE_BADGE[role as Role]
  return (
    <div className="px-2 group-data-[collapsible=icon]:hidden">
      <span
        className="inline-flex w-full items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{ backgroundColor: cfg.bg, color: cfg.color }}
      >
        {ROLE_LABELS[role as Role]}
      </span>
    </div>
  )
}
