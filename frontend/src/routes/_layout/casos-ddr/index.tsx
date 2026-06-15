import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"

import { EstadoCasoBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { EmptyState, ErrorState, LoadingState } from "@/components/Common/QueryStates"
import { CasosDdrService } from "@/client/sgddr"
import {
  diasDesde,
  ESTADOS_CASO,
  ESTADO_CASO,
  NIVELES_RIESGO,
  NIVEL_RIESGO,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/casos-ddr/")({
  component: CasosDdrPage,
  head: () => ({
    meta: [{ title: "Casos DDR — PanamaCompliance SGDDR" }],
  }),
})

const PAGE_SIZE = 20

function CasosDdrPage() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState("")
  const [nivel, setNivel] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [estado, nivel])

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["casos-ddr", { estado, nivel, page }],
    queryFn: () =>
      CasosDdrService.list({
        estado: estado || undefined,
        nivel_riesgo: nivel || undefined,
        page,
        size: PAGE_SIZE,
      }),
    retry: false,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Casos DDR"
        subtitle="Expedientes en proceso de Debida Diligencia Reforzada."
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a", color: estado ? "#f0ede8" : "#4a6080" }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CASO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_CASO[e].label}
            </option>
          ))}
        </select>

        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a", color: nivel ? "#f0ede8" : "#4a6080" }}
        >
          <option value="">Todos los niveles</option>
          {NIVELES_RIESGO.map((n) => (
            <option key={n} value={n}>
              {NIVEL_RIESGO[n].label}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <LoadingState label="Cargando casos…" />
      ) : isError ? (
        <ErrorState message={(error as Error)?.message} onRetry={() => refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState message="No hay casos DDR para mostrar." />
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid #1b2e4a" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#0f1f3a", borderBottom: "1px solid #1b2e4a" }}>
                  {["Cliente", "Nivel de riesgo", "Estado", "Días abierto"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "#4a6080" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((caso) => (
                  <tr
                    key={caso.id}
                    onClick={() => navigate({ to: "/casos-ddr/$id", params: { id: caso.id } })}
                    className="cursor-pointer transition-colors hover:bg-[#0f1f3a]"
                    style={{ borderBottom: "1px solid #1b2e4a" }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-medium" style={{ color: "#f0ede8" }}>
                        {caso.cliente
                          ? `${caso.cliente.nombres} ${caso.cliente.apellidos}`
                          : caso.cliente_id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <NivelRiesgoBadge nivel={caso.nivel_riesgo} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoCasoBadge estado={caso.estado} />
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: "#8a9bb5" }}>
                      {diasDesde(caso.fecha_apertura)} días
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid #1b2e4a", backgroundColor: "#0f1f3a" }}
          >
            <p className="text-xs" style={{ color: "#4a6080" }}>
              {total} caso{total !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[#1b2e4a] disabled:opacity-40"
                style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
              >
                Anterior
              </button>
              <span className="text-xs" style={{ color: "#8a9bb5" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border px-3 py-1.5 text-xs transition-colors hover:bg-[#1b2e4a] disabled:opacity-40"
                style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
