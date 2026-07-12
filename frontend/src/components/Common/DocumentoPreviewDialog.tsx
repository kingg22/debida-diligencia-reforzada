// Diálogo modal para previsualizar un documento del expediente.
// Descarga el archivo con disposition=inline y lo renderiza según su mime:
// PDF → iframe, JPG/PNG → <img>, otros → fallback con botón Descargar.
// Usa el tema oscuro inline del proyecto (no clases Tailwind de shadcn) para
// mantener coherencia con el resto de la página de detalle.

import { useQuery } from "@tanstack/react-query"
import { Download, FileText, Loader2, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { ClientesService, type Documento, SgddrApiError } from "@/client/sgddr"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatBytes } from "@/lib/sgddr"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  expedienteId: string
  documento: Documento | null
}

const PDF = "application/pdf"
const IMAGES = ["image/jpeg", "image/png"]

function DocPreviewContent({
  expedienteId,
  doc,
}: {
  expedienteId: string
  doc: Documento
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const query = useQuery({
    queryKey: ["doc-preview", expedienteId, doc.id],
    queryFn: () =>
      ClientesService.descargarDocumento(expedienteId, doc.id, "inline"),
    enabled: !!expedienteId && !!doc.id,
    retry: false,
    staleTime: 0,
  })

  // Construye/revoca el object URL cuando llega el blob o cambia el doc.
  useEffect(() => {
    if (!query.data) {
      setObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(query.data)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [query.data])

  const renderer = useMemo(() => {
    if (!objectUrl) return null
    const mime = (doc.mime_type || "").toLowerCase()
    if (mime === PDF) {
      return (
        <iframe
          src={objectUrl}
          title={doc.nombre}
          className="h-[70vh] w-full rounded border"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
          }}
        />
      )
    }
    if (IMAGES.includes(mime)) {
      return (
        <img
          src={objectUrl}
          alt={doc.nombre}
          className="mx-auto max-h-[70vh] rounded"
        />
      )
    }
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded border py-16 text-center"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--secondary)",
        }}
      >
        <FileText size={28} style={{ color: "var(--muted-foreground)" }} />
        <p style={{ color: "var(--foreground)" }} className="text-sm">
          Vista previa no disponible para este tipo de archivo.
        </p>
        <p style={{ color: "var(--muted-foreground)" }} className="text-xs">
          {doc.mime_type || "tipo desconocido"} · {formatBytes(doc.tamanio)}
        </p>
      </div>
    )
  }, [objectUrl, doc.mime_type, doc.nombre, doc.tamanio])

  const onDownload = async () => {
    setDownloading(true)
    try {
      const blob = await ClientesService.descargarDocumento(
        expedienteId,
        doc.id,
        "attachment",
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.nombre
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } finally {
      setDownloading(false)
    }
  }

  if (query.isError) {
    const err = query.error
    const msg =
      err instanceof SgddrApiError
        ? err.detail
        : (err as Error)?.message || "No se pudo cargar el documento."
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm" style={{ color: "var(--destructive)" }}>
          {msg}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => query.refetch()}
        >
          Reintentar
        </Button>
      </div>
    )
  }

  if (query.isPending || !renderer) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-16"
        style={{ color: "var(--muted-foreground)" }}
      >
        <Loader2
          size={22}
          className="animate-spin"
          style={{ color: "var(--primary)" }}
        />
        <p className="text-sm">Cargando documento…</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {renderer}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onDownload}
          disabled={downloading}
          className="gap-2"
          style={{
            borderColor: "var(--primary)",
            color: "var(--primary)",
            backgroundColor: "transparent",
          }}
        >
          {downloading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          Descargar
        </Button>
      </DialogFooter>
    </div>
  )
}

export function DocumentoPreviewDialog({
  open,
  onOpenChange,
  expedienteId,
  documento,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        showCloseButton={false}
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ color: "var(--foreground)" }}
          >
            <FileText size={18} style={{ color: "var(--primary)" }} />
            <span className="truncate">{documento?.nombre ?? "Documento"}</span>
          </DialogTitle>
        </DialogHeader>
        {documento ? (
          <DocPreviewContent expedienteId={expedienteId} doc={documento} />
        ) : null}
        <DialogCloseX onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

// Botón discreto de cierre adicional (esquina superior derecha) sin icono X
// por defecto del primitive para que combine con el estilo.
function DialogCloseX({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-label="Cerrar"
      onClick={() => onOpenChange(false)}
      className="absolute top-4 right-4 rounded p-1 transition-colors"
      style={{ color: "var(--muted-foreground)" }}
    >
      <X size={16} />
    </button>
  )
}
