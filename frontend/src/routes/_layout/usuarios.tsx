import { createFileRoute, redirect } from "@tanstack/react-router"

// La página real de gestión de usuarios vive en `/admin`, que está
// cableada al backend (`UsersService`). Este alias conserva el enlace del
// sidebar y cualquier marcador antiguo sin duplicar lógica.
export const Route = createFileRoute("/_layout/usuarios")({
  beforeLoad: () => {
    throw redirect({ to: "/admin" })
  },
})
