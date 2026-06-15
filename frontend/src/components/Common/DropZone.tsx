import { Check, FileText, Loader2, Upload, X } from "lucide-react"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"

const MAX_BYTES = 20 * 1024 * 1024 // 20 MB (spec RV-06)
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"]

function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Zona de carga drag & drop. Valida tipo (PDF/JPG/PNG) y tamaño (máx 20 MB).
// `onFile` recibe el archivo válido; el componente padre hace la subida real.
export function DropZone({
  label,
  file,
  uploading,
  done,
  hash,
  onFile,
  onClear,
}: {
  label: string
  file?: File | null
  uploading?: boolean
  done?: boolean
  hash?: string | null
  onFile: (file: File) => void
  onClear?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  const validar = (f: File) => {
    if (!ALLOWED.includes(f.type)) {
      setError("Formato no permitido. Usa PDF, JPG o PNG.")
      return
    }
    if (f.size > MAX_BYTES) {
      setError("El archivo supera el límite de 20 MB.")
      return
    }
    setError("")
    onFile(f)
  }

  return (
    <div>
      <p className="mb-1.5 text-sm" style={{ color: "#8a9bb5" }}>
        {label}
      </p>

      {file || done ? (
        <div
          className="flex items-center gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: "#1b2e4a", backgroundColor: "#0f1f3a" }}
        >
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(34,197,94,0.12)" }}
          >
            {uploading ? (
              <Loader2 size={16} className="animate-spin" style={{ color: "#c9a84c" }} />
            ) : (
              <Check size={16} style={{ color: "#22c55e" }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" style={{ color: "#f0ede8" }}>
              {file?.name ?? "Documento cargado"}
            </p>
            <p className="truncate text-xs font-mono" style={{ color: "#4a6080" }}>
              {file ? formatTamano(file.size) : ""}
              {hash ? ` · ${hash.slice(0, 16)}…` : ""}
            </p>
          </div>
          {onClear && !uploading && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Quitar archivo"
              className="rounded-lg p-1.5 transition-colors hover:bg-[#1b2e4a]"
              style={{ color: "#8a9bb5" }}
            >
              <X size={15} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const f = e.dataTransfer.files?.[0]
            if (f) validar(f)
          }}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 transition-colors",
          )}
          style={{
            borderColor: dragging ? "#c9a84c" : "#1b2e4a",
            backgroundColor: dragging ? "rgba(201,168,76,0.06)" : "#0a1628",
          }}
        >
          {dragging ? (
            <Upload size={20} style={{ color: "#c9a84c" }} />
          ) : (
            <FileText size={20} style={{ color: "#4a6080" }} />
          )}
          <span className="text-xs" style={{ color: "#8a9bb5" }}>
            Arrastra un archivo o haz clic para seleccionar
          </span>
          <span className="text-[11px]" style={{ color: "#4a6080" }}>
            PDF, JPG o PNG · máx. 20 MB
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) validar(f)
          e.target.value = ""
        }}
      />

      {error && (
        <p role="alert" className="mt-1.5 text-xs" style={{ color: "#e05252" }}>
          {error}
        </p>
      )}
    </div>
  )
}
