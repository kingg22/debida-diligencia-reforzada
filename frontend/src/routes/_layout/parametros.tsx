import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Loader2, Save } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { UsersService } from "@/client"
import { PageHeader } from "@/components/Common/PageHeader"
import {
  ErrorState,
  LoadingState,
} from "@/components/Common/QueryStates"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ParametrosService, type ParametroRiesgo } from "@/client/sgddr"

export const Route = createFileRoute("/_layout/parametros")({
  component: ParametrosPage,
  beforeLoad: async () => {
    const user = await UsersService.readUserMe()
    if (!user.is_superuser) {
      throw redirect({ to: "/" })
    }
  },
  head: () => ({
    meta: [{ title: "Parámetros de riesgo — PanamaCompliance SGDDR" }],
  }),
})

function ParametrosPage() {
  const qc = useQueryClient()
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["parametros-riesgo"],
    queryFn: () => ParametrosService.listar(),
  })

  // Pesos locales en edición: { [id]: peso }
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: ({ id, peso }: { id: string; peso: number }) =>
      ParametrosService.actualizar(id, peso),
    onMutate: ({ id }) => setSaving(id),
    onSuccess: (updated) => {
      toast.success(`"${updated.factor}" actualizado.`)
      setEdits((prev) => {
        const next = { ...prev }
        delete next[updated.id]
        return next
      })
      qc.invalidateQueries({ queryKey: ["parametros-riesgo"] })
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setSaving(null),
  })

  if (isPending) return <LoadingState label="Cargando parámetros…" />
  if (isError)
    return (
      <ErrorState
        message={(error as Error)?.message}
        onRetry={() => refetch()}
      />
    )

  const rows = data ?? []
  const pendientes = Object.keys(edits).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parámetros de riesgo"
        subtitle="Pesos utilizados en el cálculo automático del nivel de riesgo KYC."
      />

      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Factores de riesgo ({rows.length})
          </p>
          {pendientes > 0 && (
            <span className="text-muted-foreground text-xs">
              {pendientes} cambio{pendientes > 1 ? "s" : ""} sin guardar
            </span>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Factor</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-24 text-right">Peso (0–100)</TableHead>
              <TableHead className="w-24 text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((param: ParametroRiesgo) => {
              const localPeso = edits[param.id] ?? param.peso
              const changed = edits[param.id] !== undefined
              const isSaving = saving === param.id
              return (
                <TableRow
                  key={param.id}
                  className={
                    changed ? "bg-amber-500/5" : undefined
                  }
                >
                  <TableCell className="font-medium">{param.factor}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {param.descripcion}
                  </TableCell>
                  <TableCell className="text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={localPeso}
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, Number(e.target.value)))
                        if (v === param.peso) {
                          setEdits((prev) => {
                            const next = { ...prev }
                            delete next[param.id]
                            return next
                          })
                        } else {
                          setEdits((prev) => ({ ...prev, [param.id]: v }))
                        }
                      }}
                      className="border-input bg-background text-foreground focus:border-ring w-20 rounded-lg border px-2 py-1.5 text-right text-sm outline-none tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={changed ? "default" : "ghost"}
                      disabled={!changed || isSaving}
                      onClick={() =>
                        saveMutation.mutate({ id: param.id, peso: localPeso })
                      }
                    >
                      {isSaving ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Save size={13} />
                      )}
                      {" "}Guardar
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground text-xs">
        Los cambios se aplican a los nuevos expedientes y al recalcular. Un peso de 0 desactiva el factor.
      </p>
    </div>
  )
}
