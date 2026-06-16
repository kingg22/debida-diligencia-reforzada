import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Plus, Search, X } from "lucide-react"
import { useEffect, useState } from "react"

import { EstadoClienteBadge } from "@/components/Common/EstadoCasoBadge"
import { NivelRiesgoBadge } from "@/components/Common/NivelRiesgoBadge"
import { PageHeader } from "@/components/Common/PageHeader"
import { EmptyState, ErrorState, LoadingState } from "@/components/Common/QueryStates"
import { ClientesService } from "@/client/sgddr"
import useAuth from "@/hooks/useAuth"
import {
  type AppUser,
  ESTADOS_CLIENTE,
  ESTADO_CLIENTE,
  formatFecha,
  NIVELES_RIESGO,
  NIVEL_RIESGO,
  puedeRegistrarCliente,
} from "@/lib/sgddr"

export const Route = createFileRoute("/_layout/clientes/")({
  component: ClientesPage,
  head: () => ({
    meta: [{ title: "Clientes — PanamaCompliance SGDDR" }],
  }),
})

const PAGE_SIZE = 20

function ClientesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const rol = (user as AppUser | null | undefined)?.role

  const [searchInput, setSearchInput] = useState("")
  const [nombre, setNombre] = useState("")
  const [nivel, setNivel] = useState("")
  const [estado, setEstado] = useState("")
  const [page, setPage] = useState(1)

  // debounce de la búsqueda
  useEffect(() => {
    const t = setTimeout(() => setNombre(searchInput), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [nombre, nivel, estado])

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["clientes", { nombre, nivel, estado, page }],
    queryFn: () =>
      ClientesService.list({
        nombre: nombre || undefined,
        nivel_riesgo: nivel || undefined,
        estado: estado || undefined,
        page,
        size: PAGE_SIZE,
      }),
    retry: false,
  })

  const total = data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tieneFiltros = !!(searchInput || nivel || estado)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Expedientes KYC registrados en el sistema."
        action={
          puedeRegistrarCliente(rol) || rol === "ANALISTA_DDR" ? (
            <button
              type="button"
              onClick={() => navigate({ to: "/kyc/nuevo" })}
              className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.99]"
              style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
            >
              <Plus size={16} />
              Nuevo cliente
            </button>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "#4a6080" }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o identificación…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm text-[#f0ede8] placeholder:text-[#4a6080] outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c] focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]"
            style={{ backgroundColor: "#0f1f3a" }}
          />
        </div>

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

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="h-10 rounded-lg border px-3 text-sm outline-none transition-all border-[#1b2e4a] focus:border-[#c9a84c]"
          style={{ backgroundColor: "#0f1f3a", color: estado ? "#f0ede8" : "#4a6080" }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_CLIENTE.map((e) => (
            <option key={e} value={e}>
              {ESTADO_CLIENTE[e].label}
            </option>
          ))}
        </select>

        {tieneFiltros && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("")
              setNivel("")
              setEstado("")
            }}
            className="flex items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-[#1b2e4a]"
            style={{ borderColor: "#1b2e4a", color: "#8a9bb5" }}
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* Contenido */}
      {isPending ? (
        <LoadingState label="Cargando clientes…" />
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message}
          onRetry={() => refetch()}
        />
      ) : data && data.data.length === 0 ? (
        <EmptyState
          message={
            tieneFiltros
              ? "No se encontraron clientes con los filtros aplicados."
              : "Aún no hay clientes registrados."
          }
        />
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: "1px solid #1b2e4a" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#0f1f3a", borderBottom: "1px solid #1b2e4a" }}>
                  {["Nombre", "Identificación", "Nivel de riesgo", "Estado", "Registro"].map((h) => (
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
                {data?.data.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate({ to: "/clientes/$id", params: { id: c.id } })}
                    className="cursor-pointer transition-colors hover:bg-[#0f1f3a]"
                    style={{ borderBottom: "1px solid #1b2e4a" }}
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-medium" style={{ color: "#f0ede8" }}>
                        {c.nombres} {c.apellidos}
                      </span>
                      {c.es_pep && (
                        <span
                          className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{ backgroundColor: "rgba(201,168,76,0.15)", color: "#c9a84c" }}
                        >
                          PEP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs" style={{ color: "#8a9bb5" }}>
                      {c.numero_identificacion}
                    </td>
                    <td className="px-4 py-3.5">
                      <NivelRiesgoBadge nivel={c.nivel_riesgo} />
                    </td>
                    <td className="px-4 py-3.5">
                      <EstadoClienteBadge estado={c.estado} />
                    </td>
                    <td className="px-4 py-3.5 text-xs" style={{ color: "#8a9bb5" }}>
                      {formatFecha(c.creado_en)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid #1b2e4a", backgroundColor: "#0f1f3a" }}
          >
            <p className="text-xs" style={{ color: "#4a6080" }}>
              {total} cliente{total !== 1 ? "s" : ""}
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
