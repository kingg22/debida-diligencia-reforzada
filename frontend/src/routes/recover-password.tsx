import { useState } from "react"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react"
import { isLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const schema = z.object({
  email: z
    .string()
    .min(1, "El correo es requerido")
    .email("Ingresa un correo electrónico válido"),
})
type FormData = z.infer<typeof schema>

export const Route = createFileRoute("/recover-password")({
  component: RecoverPassword,
  beforeLoad: async () => {
    if (isLoggedIn()) throw redirect({ to: "/" })
  },
  head: () => ({
    meta: [{ title: "Recuperar Contraseña — PanamaCompliance SGDDR" }],
  }),
})

function RecoverPassword() {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  const onSubmit = async () => {
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    setSent(true)
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "#040d1c" }}
    >
      <div className="w-full max-w-md">
        <RouterLink
          to="/login"
          className="mb-10 inline-flex items-center gap-2 text-sm transition-colors hover:text-[#c9a84c]"
          style={{ color: "#8a9bb5" }}
        >
          <ArrowLeft size={15} /> Volver al inicio de sesión
        </RouterLink>

        <h1
          className="mb-3 text-[32px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Recuperar contraseña
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: "#8a9bb5" }}>
          Ingresa tu correo institucional y te enviaremos instrucciones para
          restablecer tu contraseña.
        </p>

        {!sent ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label
                htmlFor="rec-email"
                className="mb-1.5 block text-sm"
                style={{ color: "#8a9bb5" }}
              >
                Correo electrónico
              </label>
              <input
                id="rec-email"
                type="email"
                autoFocus
                autoComplete="email"
                placeholder="correo@institución.com"
                disabled={loading}
                {...register("email")}
                className={cn(
                  "h-11 w-full rounded-lg border px-4 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
                  "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
                  "disabled:opacity-50",
                  errors.email
                    ? "border-[#e05252] focus:border-[#e05252]"
                    : "border-[#1b2e4a] focus:border-[#c9a84c]",
                )}
                style={{ backgroundColor: "#0f1f3a" }}
              />
              {errors.email && (
                <p
                  role="alert"
                  className="mt-1.5 text-xs"
                  style={{ color: "#e05252" }}
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex h-11 w-full items-center justify-center gap-2 rounded-lg",
                "text-sm font-semibold transition-all hover:brightness-110",
                "disabled:cursor-not-allowed disabled:opacity-70",
              )}
              style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Enviando…
                </>
              ) : (
                "Enviar instrucciones"
              )}
            </button>
          </form>
        ) : (
          <div
            role="alert"
            className="flex items-start gap-4 rounded-xl p-5"
            style={{
              backgroundColor: "rgba(34,197,94,0.08)",
              border: "1px solid rgba(34,197,94,0.30)",
            }}
          >
            <CheckCircle
              size={20}
              className="mt-0.5 flex-shrink-0"
              style={{ color: "#22c55e" }}
            />
            <div>
              <p
                className="mb-1 text-sm font-semibold"
                style={{ color: "#22c55e" }}
              >
                Instrucciones enviadas
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "#8a9bb5" }}>
                Si el correo está registrado en el sistema, recibirás las
                instrucciones en breve. Revisa también tu carpeta de spam.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
