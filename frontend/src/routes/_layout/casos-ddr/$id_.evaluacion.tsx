import { useMutation } from "@tanstack/react-query"
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { CasosDdrService, type CuestionarioInput } from "@/client/sgddr"
import { DropZone } from "@/components/Common/DropZone"
import { PageHeader } from "@/components/Common/PageHeader"
import { WizardProgress } from "@/components/Common/WizardProgress"

export const Route = createFileRoute("/_layout/casos-ddr/$id_/evaluacion")({
  component: EvaluacionPage,
  head: () => ({
    meta: [{ title: "Evaluación DDR — PanamaCompliance SGDDR" }],
  }),
})

const PATRIMONIOS = [
  { value: "MENOS_100K", label: "Menos de $100k" },
  { value: "100K_500K", label: "$100k – $500k" },
  { value: "500K_1M", label: "$500k – $1M" },
  { value: "MAS_1M", label: "Más de $1M" },
]

const DOCS_DDR = [
  {
    tipo: "DECLARACION_FONDOS",
    label: "Declaración jurada de origen de fondos",
  },
  { tipo: "REFERENCIA_BANCARIA", label: "Referencia bancaria" },
  { tipo: "ESTADOS_FINANCIEROS", label: "Estado financiero" },
] as const

type Form = {
  origen_fondos: string
  proposito_relacion: string
  patrimonio_estimado: string
  pais_origen_patrimonio: string
  tiene_estructura_societaria: boolean | null
  familiar_pep: boolean | null
}

const VACIO: Form = {
  origen_fondos: "",
  proposito_relacion: "",
  patrimonio_estimado: "",
  pais_origen_patrimonio: "",
  tiene_estructura_societaria: null,
  familiar_pep: null,
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="mb-1.5 block text-sm"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </label>
  )
}

function RadioSiNo({
  value,
  onChange,
}: {
  value: boolean | null
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      {[
        { v: true, l: "Sí" },
        { v: false, l: "No" },
      ].map(({ v, l }) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(v)}
          className="rounded-lg border px-5 py-2 text-sm transition-colors"
          style={
            value === v
              ? {
                  borderColor: "var(--primary)",
                  backgroundColor: "rgba(201,168,76,0.1)",
                  color: "var(--primary)",
                }
              : {
                  borderColor: "var(--border)",
                  color: "var(--muted-foreground)",
                }
          }
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function EvaluacionPage() {
  const { id } = useParams({ from: "/_layout/casos-ddr/$id_/evaluacion" })
  const navigate = useNavigate()

  const [etapa, setEtapa] = useState(0) // 0 = cuestionario, 1 = documentos
  const [form, setForm] = useState<Form>(VACIO)
  const [docs, setDocs] = useState<
    Record<string, { file: File; hash?: string }>
  >({})

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const cuestionarioValido =
    form.origen_fondos.trim().length >= 20 &&
    form.proposito_relacion.trim().length >= 20 &&
    !!form.patrimonio_estimado &&
    !!form.pais_origen_patrimonio.trim() &&
    form.tiene_estructura_societaria !== null &&
    form.familiar_pep !== null

  const guardarCuestionario = useMutation({
    mutationFn: () =>
      CasosDdrService.guardarCuestionario(id, form as CuestionarioInput),
    onSuccess: () => {
      toast.success("Cuestionario EBR guardado.")
      setEtapa(1)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const subirDoc = useMutation({
    mutationFn: ({ tipo, file }: { tipo: string; file: File }) =>
      CasosDdrService.subirDocumento(id, tipo, file),
    onSuccess: (doc, vars) => {
      setDocs((d) => ({
        ...d,
        [vars.tipo]: { file: vars.file, hash: doc.hash_sha256 ?? undefined },
      }))
      toast.success("Documento cargado.")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const enviar = useMutation({
    mutationFn: () => CasosDdrService.enviarAprobacion(id),
    onSuccess: () => {
      toast.success(
        "Investigación enviada al Oficial de Cumplimiento para su revisión.",
      )
      navigate({ to: "/casos-ddr/$id", params: { id } })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const todosLosDocs = DOCS_DDR.every((d) => docs[d.tipo])

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate({ to: "/casos-ddr/$id", params: { id } })}
        className="flex items-center gap-1.5 text-sm transition-colors hover:text-primary"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={15} /> Volver al caso
      </button>

      <PageHeader
        title="Evaluación DDR"
        subtitle="Cuestionario EBR y documentación de soporte (Ley 23/2015 Art. 27-28)."
      />

      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <WizardProgress
          steps={["Cuestionario EBR", "Documentos"]}
          current={etapa}
        />
      </div>

      {etapa === 0 ? (
        <div
          className="space-y-5 rounded-xl p-6"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <div>
            <Label>Describa el origen de los fondos del cliente</Label>
            <textarea
              rows={3}
              value={form.origen_fondos}
              onChange={(e) => set("origen_fondos", e.target.value)}
              className="w-full rounded-lg border p-3 text-sm text-foreground outline-none border-border focus:border-primary"
              style={{ backgroundColor: "var(--secondary)" }}
            />
            <p
              className="mt-1 text-xs"
              style={{
                color:
                  form.origen_fondos.trim().length >= 20
                    ? "#22c55e"
                    : "var(--dim-foreground)",
              }}
            >
              {form.origen_fondos.trim().length}/20 caracteres mínimos
            </p>
          </div>

          <div>
            <Label>¿Cuál es el propósito de la relación comercial?</Label>
            <textarea
              rows={3}
              value={form.proposito_relacion}
              onChange={(e) => set("proposito_relacion", e.target.value)}
              className="w-full rounded-lg border p-3 text-sm text-foreground outline-none border-border focus:border-primary"
              style={{ backgroundColor: "var(--secondary)" }}
            />
            <p
              className="mt-1 text-xs"
              style={{
                color:
                  form.proposito_relacion.trim().length >= 20
                    ? "#22c55e"
                    : "var(--dim-foreground)",
              }}
            >
              {form.proposito_relacion.trim().length}/20 caracteres mínimos
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label>Patrimonio estimado</Label>
              <select
                value={form.patrimonio_estimado}
                onChange={(e) => set("patrimonio_estimado", e.target.value)}
                className="h-10 w-full rounded-lg border px-3 text-sm outline-none border-border focus:border-primary"
                style={{
                  backgroundColor: "var(--secondary)",
                  color: form.patrimonio_estimado
                    ? "var(--foreground)"
                    : "var(--dim-foreground)",
                }}
              >
                <option value="">Selecciona…</option>
                {PATRIMONIOS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>País de origen del patrimonio</Label>
              <input
                type="text"
                value={form.pais_origen_patrimonio}
                onChange={(e) => set("pais_origen_patrimonio", e.target.value)}
                className="h-10 w-full rounded-lg border px-3 text-sm text-foreground outline-none border-border focus:border-primary"
                style={{ backgroundColor: "var(--secondary)" }}
                placeholder="Ej. Panamá"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label>¿Tiene estructura societaria compleja?</Label>
              <RadioSiNo
                value={form.tiene_estructura_societaria}
                onChange={(v) => set("tiene_estructura_societaria", v)}
              />
            </div>
            <div>
              <Label>¿Tiene familiares que sean PEP?</Label>
              <RadioSiNo
                value={form.familiar_pep}
                onChange={(v) => set("familiar_pep", v)}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!cuestionarioValido || guardarCuestionario.isPending}
              onClick={() => guardarCuestionario.mutate()}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {guardarCuestionario.isPending
                ? "Guardando…"
                : "Guardar y continuar"}
            </button>
          </div>
        </div>
      ) : (
        <div
          className="space-y-5 rounded-xl p-6"
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {DOCS_DDR.map((d) => (
            <DropZone
              key={d.tipo}
              label={d.label}
              file={docs[d.tipo]?.file}
              done={!!docs[d.tipo]}
              hash={docs[d.tipo]?.hash}
              uploading={
                subirDoc.isPending && subirDoc.variables?.tipo === d.tipo
              }
              onFile={(file) => subirDoc.mutate({ tipo: d.tipo, file })}
            />
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!todosLosDocs || enviar.isPending}
              onClick={() => enviar.mutate()}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {enviar.isPending
                ? "Enviando…"
                : "Enviar al Oficial de Cumplimiento"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
