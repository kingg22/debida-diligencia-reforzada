import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/kyc/")({
  beforeLoad: () => {
    throw redirect({ to: "/kyc/nuevo" })
  },
})
