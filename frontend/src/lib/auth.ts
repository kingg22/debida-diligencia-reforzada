// Utilidades de sesión basadas en el JWT real emitido por el backend.

interface JwtPayload {
  exp?: number // segundos desde epoch (estándar JWT)
  sub?: string
}

/** Decodifica el payload de un JWT sin validar la firma (solo lectura en cliente). */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

/** Fecha de expiración de la sesión a partir del token en localStorage, o null. */
export function getTokenExpiry(): Date | null {
  const token = localStorage.getItem("access_token")
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload?.exp) return null
  return new Date(payload.exp * 1000)
}
