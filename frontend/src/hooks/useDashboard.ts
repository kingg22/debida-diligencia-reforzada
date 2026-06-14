import { useQuery } from "@tanstack/react-query"

import { DashboardService } from "@/client/sgddr"
import { isLoggedIn } from "./useAuth"

// KPIs del dashboard según el rol del usuario (GET /api/v1/dashboard).
// Mientras el endpoint no exista, la query queda en estado de error y la
// pantalla muestra "—"; se ilumina sola cuando Dev 2 publica el endpoint.
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: DashboardService.get,
    enabled: isLoggedIn(),
    retry: false,
    staleTime: 60_000,
  })
}
