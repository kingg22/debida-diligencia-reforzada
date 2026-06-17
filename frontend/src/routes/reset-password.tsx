import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  PasswordChecklist,
  passwordIsValid,
} from "@/components/auth/PasswordChecklist"
import { PasswordStrengthBar } from "@/components/auth/PasswordStrengthBar"
import { isLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const searchSchema = z.object({ token: z.string().catch("") })

const schema = z
  .object({
    new_password: z.string().min(1, "La contraseña es requerida"),
    confirm_password: z.string().min(1, "Confirma tu contraseña"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
  })

type FormData = z.infer<typeof schema>

export const Route = createFileRoute("/reset-password")({
  component: ResetPassword,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    if (isLoggedIn()) throw redirect({ to: "/" })
    if (!search.token) throw redirect({ to: "/recover-password" })
  },
  head: () => ({
    meta: [{ title: "Nueva Contraseña — PanamaCompliance SGDDR" }],
  }),
})

function ResetPassword() {
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { new_password: "", confirm_password: "" },
  })

  const newPw = watch("new_password")
  const canSubmit = passwordIsValid(newPw)

  const onSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 1000))
    setLoading(false)
    navigate({ to: "/login" })
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "#040d1c" }}
    >
      <div className="w-full max-w-md">
        <h1
          className="mb-8 text-[32px]"
          style={{ fontFamily: "DM Serif Display, serif", color: "#f0ede8" }}
        >
          Nueva contraseña
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* New password */}
          <div>
            <label
              htmlFor="new_pw"
              className="mb-1.5 block text-sm"
              style={{ color: "#8a9bb5" }}
            >
              Contraseña nueva
            </label>
            <div className="relative">
              <input
                id="new_pw"
                type={showNew ? "text" : "password"}
                placeholder="••••••••"
                {...register("new_password")}
                className={cn(
                  "h-11 w-full rounded-lg border px-4 pr-11 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
                  "outline-none transition-all focus:border-[#c9a84c] focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
                  "border-[#1b2e4a]",
                )}
                style={{ backgroundColor: "#0f1f3a" }}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                aria-label={showNew ? "Ocultar" : "Mostrar"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:text-[#c9a84c]"
                style={{ color: "#4a6080" }}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {newPw && (
              <div className="mt-3 space-y-3">
                <PasswordStrengthBar password={newPw} />
                <PasswordChecklist password={newPw} />
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label
              htmlFor="confirm_pw"
              className="mb-1.5 block text-sm"
              style={{ color: "#8a9bb5" }}
            >
              Confirmar contraseña nueva
            </label>
            <div className="relative">
              <input
                id="confirm_pw"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                {...register("confirm_password")}
                className={cn(
                  "h-11 w-full rounded-lg border px-4 pr-11 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
                  "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
                  errors.confirm_password
                    ? "border-[#e05252] focus:border-[#e05252]"
                    : "border-[#1b2e4a] focus:border-[#c9a84c]",
                )}
                style={{ backgroundColor: "#0f1f3a" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                aria-label={showConfirm ? "Ocultar" : "Mostrar"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:text-[#c9a84c]"
                style={{ color: "#4a6080" }}
              >
                {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.confirm_password && (
              <p
                role="alert"
                className="mt-1.5 text-xs"
                style={{ color: "#e05252" }}
              >
                {errors.confirm_password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className={cn(
              "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg",
              "text-sm font-semibold transition-all hover:brightness-110",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
            style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Guardando…
              </>
            ) : (
              "Restablecer contraseña"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <RouterLink
            to="/login"
            className="text-sm transition-colors hover:text-[#c9a84c]"
            style={{ color: "#4a6080" }}
          >
            ← Volver al inicio de sesión
          </RouterLink>
        </div>
      </div>
    </div>
  )
}
