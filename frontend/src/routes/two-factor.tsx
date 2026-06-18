import { createFileRoute, redirect } from "@tanstack/react-router"

// El backend no expone un endpoint de 2FA, así que esta ruta solo
// existe como alias para no romper enlaces antiguos. Redirige a /login.
export const Route = createFileRoute("/two-factor")({
  beforeLoad: () => {
    throw redirect({ to: "/login" })
  },
})
