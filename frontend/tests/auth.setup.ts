import { test as setup } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"

const authFile = "playwright/.auth/user.json"

setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByPlaceholder("correo@institución.com").fill(firstSuperuser)
  await page.getByPlaceholder("••••••••").fill(firstSuperuserPassword)
  await page.getByRole("button", { name: "Ingresar" }).click()
  await page.waitForURL("/")
  await page.context().storageState({ path: authFile })
})
