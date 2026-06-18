import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const schema = z.object({
  email: z
    .string()
    .min(1, "El correo es requerido")
    .email("Ingresa un correo electrónico válido"),
  password: z.string().min(1, "La contraseña es requerida"),
})
type FormData = z.infer<typeof schema>

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) throw redirect({ to: "/" })
  },
  head: () => ({
    meta: [{ title: "Iniciar Sesión — PanamaCompliance SGDDR" }],
  }),
})

type LoginState =
  | "idle"
  | "loading"
  | "error_credentials"
  | "error_approaching_lock"
  | "error_last_attempt"

function Login() {
  const navigate = useNavigate()
  const [state, setState] = useState<LoginState>("idle")
  const [attempts, setAttempts] = useState(0)
  const [showPw, setShowPw] = useState(false)
  const { loginMutation } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (data: FormData) => {
    setState("loading")

    loginMutation.mutate(
      { username: data.email, password: data.password },
      {
        onSuccess: () => {
          navigate({ to: "/" })
        },
        onError: () => {
          const next = attempts + 1
          setAttempts(next)

          if (next >= 5) {
            navigate({ to: "/account-locked" })
            return
          }

          if (next <= 2) setState("error_credentials")
          else if (next === 3) setState("error_approaching_lock")
          else setState("error_last_attempt")
        },
      },
    )
  }

  const remaining = 5 - attempts

  return (
    <div className="flex min-h-screen">
      {/* ── Left: branding ───────────────────────────────────────────── */}
      <div
        className="relative hidden flex-col overflow-hidden lg:flex lg:w-[45%]"
        style={{ backgroundColor: "#040d1c" }}
      >
        <div className="dot-grid absolute inset-0" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-14 text-center">
          {/* Shield logo */}
          <div className="mb-8">
            <svg
              width="76"
              height="88"
              viewBox="0 0 76 88"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M38 2L4 15v27c0 21.8 13.8 42.1 34 49.2C58.2 84.1 72 63.8 72 42V15L38 2z"
                fill="#0a1628"
                stroke="#c9a84c"
                strokeWidth="1.8"
              />
              <path
                d="M38 10L10 21v21c0 17 10.7 33 28 38.7C73.3 75 56 58 56 42V21L38 10z"
                fill="#1b2e4a"
              />
              <text
                x="38"
                y="47"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#c9a84c"
                fontSize="17"
                fontFamily="DM Serif Display, serif"
              >
                PC
              </text>
            </svg>
          </div>

          <h1
            className="mb-3 text-[28px] leading-tight"
            style={{
              fontFamily: "DM Serif Display, serif",
              color: "#f0ede8",
            }}
          >
            PanamaCompliance
          </h1>

          <p
            className="mb-8 text-base leading-relaxed"
            style={{ color: "#8a9bb5" }}
          >
            Sistema de Gestión de
            <br />
            Debida Diligencia Reforzada
          </p>

          <div
            className="rounded-xl px-5 py-4"
            style={{
              backgroundColor: "#0a1628",
              border: "1px solid #1b2e4a",
            }}
          >
            <p className="text-xs leading-relaxed" style={{ color: "#4a6080" }}>
              Plataforma regulada bajo{" "}
              <span style={{ color: "#8a9bb5" }}>Ley 23/2015</span> y{" "}
              <span style={{ color: "#8a9bb5" }}>Ley 254/2021</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── Right: form ──────────────────────────────────────────────── */}
      <div
        className="flex flex-1 flex-col"
        style={{ backgroundColor: "#0a1628" }}
      >
        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <p
              className="mb-1.5 text-xs uppercase tracking-widest"
              style={{ color: "#4a6080" }}
            >
              Sistema DDR
            </p>
            <h2
              className="mb-8 text-[38px] leading-tight"
              style={{
                fontFamily: "DM Serif Display, serif",
                color: "#f0ede8",
              }}
            >
              Iniciar Sesión
            </h2>

            {/* ── Error banners ─────────────────────────────────────── */}
            {state === "error_credentials" && (
              <ErrorBanner variant="error">
                Correo o contraseña incorrectos.
              </ErrorBanner>
            )}
            {state === "error_approaching_lock" && (
              <ErrorBanner variant="warning">
                Tienes{" "}
                <strong>
                  {remaining} {remaining === 1 ? "intento" : "intentos"}
                </strong>{" "}
                restantes antes de que tu cuenta sea bloqueada.
              </ErrorBanner>
            )}
            {state === "error_last_attempt" && (
              <ErrorBanner variant="error">
                <span className="font-semibold">
                  Último intento disponible.
                </span>
                <br />
                <span className="opacity-80">
                  Después de este intento tu cuenta será bloqueada
                  temporalmente.
                </span>
              </ErrorBanner>
            )}

            {/* ── Form ─────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm"
                  style={{ color: "#8a9bb5" }}
                >
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="correo@institución.com"
                  disabled={loginMutation.isPending}
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

              {/* Password */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-sm"
                    style={{ color: "#8a9bb5" }}
                  >
                    Contraseña
                  </label>
                  <RouterLink
                    to="/recover-password"
                    className="text-sm transition-colors hover:underline"
                    style={{ color: "#c9a84c" }}
                  >
                    ¿Olvidaste tu contraseña?
                  </RouterLink>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    disabled={loginMutation.isPending}
                    {...register("password")}
                    className={cn(
                      "h-11 w-full rounded-lg border px-4 pr-11 text-sm text-[#f0ede8] placeholder:text-[#4a6080]",
                      "outline-none transition-all focus:ring-[3px] focus:ring-[rgba(201,168,76,0.18)]",
                      "disabled:opacity-50",
                      errors.password
                        ? "border-[#e05252] focus:border-[#e05252]"
                        : "border-[#1b2e4a] focus:border-[#c9a84c]",
                    )}
                    style={{ backgroundColor: "#0f1f3a" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    aria-label={
                      showPw ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:text-[#c9a84c]"
                    style={{ color: "#4a6080" }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p
                    role="alert"
                    className="mt-1.5 text-xs"
                    style={{ color: "#e05252" }}
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className={cn(
                  "mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg",
                  "text-sm font-semibold transition-all",
                  "hover:brightness-110 active:scale-[0.99]",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                )}
                style={{ backgroundColor: "#c9a84c", color: "#040d1c" }}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Verificando…
                  </>
                ) : (
                  "Ingresar"
                )}
              </button>
            </form>

            <p
              className="mt-8 text-center text-xs"
              style={{ color: "#4a6080" }}
            >
              PanamaCompliance v1.0 — Sistema SGDDR
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Helper banner component ───────────────────────────────────────── */
function ErrorBanner({
  variant,
  children,
}: {
  variant: "error" | "warning"
  children: React.ReactNode
}) {
  const isError = variant === "error"
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-lg p-4"
      style={{
        backgroundColor: isError
          ? "rgba(224,82,82,0.10)"
          : "rgba(217,119,6,0.10)",
        border: `1px solid ${isError ? "rgba(224,82,82,0.35)" : "rgba(217,119,6,0.35)"}`,
      }}
    >
      <AlertTriangle
        size={16}
        className="mt-0.5 flex-shrink-0"
        style={{ color: isError ? "#e05252" : "#d97706" }}
      />
      <p
        className="text-sm leading-relaxed"
        style={{ color: isError ? "#e05252" : "#d97706" }}
      >
        {children}
      </p>
    </div>
  )
}
