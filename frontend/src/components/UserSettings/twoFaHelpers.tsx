import { Copy } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"

export async function copyToClipboardCodes(
  codes: string[],
  showSuccessToast: (msg: string) => void,
  showErrorToast: (msg: string) => void,
) {
  try {
    await navigator.clipboard.writeText(codes.join("\n"))
    showSuccessToast("Códigos copiados al portapapeles")
  } catch {
    showErrorToast("No se pudo copiar")
  }
}

export function BackupCodesGrid({
  codes,
  className,
}: {
  codes: string[]
  className?: string
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 rounded-lg border p-4 font-mono text-sm ${className ?? ""}`}
    >
      {codes.map((code) => (
        <div key={code} className="text-center">
          {code}
        </div>
      ))}
    </div>
  )
}

export function CopyCodesButton({ codes }: { codes: string[] }) {
  const { showSuccessToast, showErrorToast } = useCustomToast()

  return (
    <Button
      variant="outline"
      onClick={() =>
        copyToClipboardCodes(codes, showSuccessToast, showErrorToast)
      }
    >
      <Copy size={14} />
      Copiar
    </Button>
  )
}
