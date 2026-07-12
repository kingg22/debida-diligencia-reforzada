import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { type AuditoriaEntry, AuditoriaService } from "@/client/sgddr"
import { PageHeader } from "@/components/Common/PageHeader"
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatFechaHora } from "@/lib/sgddr"

const PAGE_SIZE = 20

const MODULOS = ["KYC", "DDR", "USUARIO", "AUTH", "SISTEMA"]

export const Route = createFileRoute("/_layout/auditoria")({
  component: AuditoriaPage,
  head: () => ({
    meta: [{ title: "Bitácora de auditoría — PanamaCompliance SGDDR" }],
  }),
})

function AuditoriaPage() {
  const [page, setPage] = useState(1)
  const [modulo, setModulo] = useState("")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")

  const skip = (page - 1) * PAGE_SIZE

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["auditoria", skip, modulo, desde, hasta],
    queryFn: () =>
      AuditoriaService.list({
        skip,
        limit: PAGE_SIZE,
        modulo: modulo || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      }),
  })

  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function resetFiltros() {
    setPage(1)
    setModulo("")
    setDesde("")
    setHasta("")
  }

  const hayFiltros = !!(modulo || desde || hasta)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora de auditoría"
        subtitle="Registro de todas las acciones realizadas en el sistema."
      />

      {/* Filtros */}
      <div className="bg-card rounded-xl border p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={modulo}
            onChange={(e) => {
              setModulo(e.target.value)
              setPage(1)
            }}
            className="border-input bg-background text-foreground focus:border-ring h-10 rounded-lg border px-3 text-sm outline-none"
          >
            <option value="">Todos los módulos</option>
            {MODULOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-xs whitespace-nowrap">
              Desde
            </label>
            <Input
              type="datetime-local"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value)
                setPage(1)
              }}
              className="h-10 w-52 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-xs whitespace-nowrap">
              Hasta
            </label>
            <Input
              type="datetime-local"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value)
                setPage(1)
              }}
              className="h-10 w-52 text-sm"
            />
          </div>

          {hayFiltros && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFiltros}
            >
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Eventos registrados
          </p>
          {total > 0 && (
            <span className="text-muted-foreground text-xs">
              {total.toLocaleString()} en total
            </span>
          )}
        </div>

        {isPending ? (
          <div className="p-6">
            <LoadingState label="Cargando bitácora…" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <ErrorState
              message={(error as Error)?.message}
              onRetry={() => refetch()}
            />
          </div>
        ) : (data?.data ?? []).length === 0 ? (
          <div className="p-6">
            <EmptyState message="No hay eventos que coincidan con los filtros." />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Fecha</TableHead>
                  <TableHead className="w-36">Usuario</TableHead>
                  <TableHead className="w-20">Módulo</TableHead>
                  <TableHead className="w-44">Acción</TableHead>
                  <TableHead>Descripción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.data ?? []).map((e: AuditoriaEntry) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                      {formatFechaHora(e.creado_en)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.usuario_nombre ?? (
                        <span className="text-muted-foreground italic">
                          Sistema
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                        {e.modulo}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.accion}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.descripcion ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="border-t px-5 py-4 flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
