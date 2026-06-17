/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL del backend FastAPI. Se define por entorno en `.env`,
   * `.env.development`, `.env.production` o vía Docker build args.
   *
   * Ejemplos:
   *   VITE_API_URL=http://localhost:8000
   *   VITE_API_URL=http://backend:8000
   *   VITE_API_URL=https://api.staging.panamacompliance.com
   *   VITE_API_URL=https://api.panamacompliance.com
   */
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
