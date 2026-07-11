import { useEffect, useState } from "react"

import { getTokenExpiry } from "@/lib/auth"

function secondsLeft(): number {
  const exp = getTokenExpiry()
  if (!exp) return 0
  return Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000))
}

/** Segundos restantes de sesión, recalculados cada segundo desde el `exp` del JWT. */
function useSessionCountdown() {
  const [secsLeft, setSecsLeft] = useState(secondsLeft)

  useEffect(() => {
    const id = setInterval(() => setSecsLeft(secondsLeft()), 1000)
    return () => clearInterval(id)
  }, [])

  return secsLeft
}

export default useSessionCountdown
