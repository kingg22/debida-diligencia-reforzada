// Utilidades de sesión basadas en el JWT real del backend.
// El token se guarda en localStorage("access_token") tras el login.

interface JwtPayload {
  exp?: number
  sub?: string
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    // base64url -> base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const json = atob(base64)
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

// Lee la expiración del token (claim exp) sin verificar la firma.
// Se usa para el contador de sesión del header.
export function getTokenExpiry(): Date | null {
  const token = localStorage.getItem("access_token")
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload?.exp) return null
  return new Date(payload.exp * 1000)
}
