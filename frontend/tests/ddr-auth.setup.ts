import { test as setup, expect } from "@playwright/test"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE = process.env.API_BASE_URL || "http://backend:8000"

const users = {
  admin: { email: "admin@example.com", password: "changethis" },
  analista: { email: "analista@example.com", password: "changethis" },
  oficial: { email: "oficial@example.com", password: "changethis" },
  gerente: { email: "gerente@example.com", password: "changethis" },
}

async function loginAPI(user: { email: string; password: string }) {
  const res = await fetch(`${BASE}/api/v1/login/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: user.email, password: user.password }),
  })
  const data = await res.json()
  return data.access_token as string
}

for (const [name, user] of Object.entries(users)) {
  setup(`authenticate ${name}`, async ({ page }) => {
    const token = await loginAPI(user)
    await page.goto("/")
    await page.evaluate((t) => {
      localStorage.setItem("access_token", t)
    }, token)
    await page.goto("/")
    const authDir = path.join(__dirname, "../playwright/.auth")
    await page.context().storageState({
      path: path.join(authDir, `${name}.json`),
    })
  })
}
