import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"

import {
  type AuthLoginData,
  AuthService,
  type LoginResponse,
  type UserPublic,
  type UserRegister,
  UsersService,
} from "@/client"
import { handleError } from "@/utils"
import useCustomToast from "./useCustomToast"

const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

/** Token temporal entregado por /auth/login cuando se requiere 2FA. */
const TEMP_TOKEN_KEY = "twofa_temp_token"

const setTempToken = (token: string) => {
  sessionStorage.setItem(TEMP_TOKEN_KEY, token)
}
const getTempToken = (): string | null => {
  return sessionStorage.getItem(TEMP_TOKEN_KEY)
}
const clearTempToken = () => {
  sessionStorage.removeItem(TEMP_TOKEN_KEY)
}

const useAuth = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const { data: user } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
  })

  const signUpMutation = useMutation({
    mutationFn: (data: UserRegister) =>
      UsersService.registerUser({ requestBody: data }),
    onSuccess: () => {
      navigate({ to: "/login" })
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })

  /**
   * Login con el backend unificado ``/auth/login``.
   *
   * El backend puede responder con 3 ramas:
   *  1. ``requires_2fa = false``  → JWT directo, redirigir a "/".
   *  2. ``requires_2fa = "verify"`` → 2FA activo, pedir código en "/two-factor".
   *  3. ``requires_2fa = "setup"`` → forzar wizard en "/two-factor/setup".
   */
  const login = async (data: { username: string; password: string }) => {
    const body: AuthLoginData["requestBody"] = {
      correo: data.username,
      password: data.password,
    }
    const response: LoginResponse = await AuthService.login({
      requestBody: body,
    })

    // Rama 1: login completo
    if (response.requires_2fa === false && response.access_token) {
      localStorage.setItem("access_token", response.access_token)
      clearTempToken()
      return { kind: "authenticated" as const }
    }

    // Ramas 2/3: requiere 2FA (verify o setup). El frontend decide a qué
    // pantalla ir en base a ``requires_2fa``.
    if (response.temp_token) {
      setTempToken(response.temp_token)
    }
    return {
      kind: "needs_2fa" as const,
      requires_2fa: response.requires_2fa as "verify" | "setup",
    }
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onError: handleError.bind(showErrorToast),
  })

  const logout = () => {
    // Llamar /auth/logout si tenemos token; no bloqueamos la UI.
    if (isLoggedIn()) {
      AuthService.logout().catch(() => undefined)
    }
    localStorage.removeItem("access_token")
    clearTempToken()
    // Limpia todo el caché de React Query: evita que datos del usuario que
    // cierra sesión (perfil, clientes, casos DDR, etc.) queden servidos al
    // siguiente usuario que inicie sesión en la misma pestaña.
    queryClient.clear()
    navigate({ to: "/login" })
  }

  return {
    signUpMutation,
    loginMutation,
    logout,
    user,
    tempToken: getTempToken(),
    clearTempToken,
  }
}

export { clearTempToken, getTempToken, isLoggedIn }
export default useAuth
