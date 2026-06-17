import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react"
import { cn } from "@/lib/utils"

interface OTPInputProps {
  length?: number
  onComplete: (code: string) => void
  error?: boolean
  disabled?: boolean
}

export function OTPInput({
  length = 6,
  onComplete,
  error = false,
  disabled = false,
}: OTPInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""))
  const [shake, setShake] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (!error) return
    setShake(true)
    setValues(Array(length).fill(""))
    const t = setTimeout(() => {
      setShake(false)
      refs.current[0]?.focus()
    }, 480)
    return () => clearTimeout(t)
  }, [error, length])

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...values]
    next[i] = val.slice(-1)
    setValues(next)
    if (val && i < length - 1) refs.current[i + 1]?.focus()
    if (next.every((v) => v !== "")) onComplete(next.join(""))
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !values[i] && i > 0)
      refs.current[i - 1]?.focus()
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length)
    if (!pasted) return
    const next = Array(length).fill("") as string[]
    pasted.split("").forEach((c, idx) => {
      if (idx < length) next[idx] = c
    })
    setValues(next)
    const firstEmpty = next.findIndex((v) => !v)
    refs.current[firstEmpty === -1 ? length - 1 : firstEmpty]?.focus()
    if (next.every((v) => v !== "")) onComplete(next.join(""))
  }

  return (
    <div className={cn("flex items-center gap-0", shake && "animate-shake")}>
      {Array.from({ length }, (_, i) => (
        <div key={i} className="flex items-center">
          {i === 3 && (
            <div
              className="mx-2 h-px w-4 flex-shrink-0"
              style={{ backgroundColor: "#1b2e4a" }}
            />
          )}
          <input
            ref={(el) => {
              refs.current[i] = el
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={values[i]}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`Dígito ${i + 1} de ${length}`}
            className={cn(
              "mx-1 h-14 w-12 rounded-lg border-2 text-center text-2xl outline-none transition-all",
              "font-mono disabled:cursor-not-allowed disabled:opacity-50",
              "focus:shadow-[0_0_0_3px_rgba(201,168,76,0.18)]",
              error
                ? "border-[#e05252] text-[#e05252]"
                : values[i]
                  ? "border-[#c9a84c]/60 text-[#f0ede8]"
                  : "border-[#1b2e4a] text-[#f0ede8]",
              "focus:border-[#c9a84c]",
            )}
            style={{ backgroundColor: "#0f1f3a" }}
          />
        </div>
      ))}
    </div>
  )
}
