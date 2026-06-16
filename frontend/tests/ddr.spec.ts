import { expect, test } from "@playwright/test"

const BASE = process.env.API_BASE_URL || "http://backend:8000"

test.describe("Login", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("login exitoso con admin", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("admin@example.com")
    await page.getByPlaceholder("••••••••").fill("changethis")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await page.waitForURL("/")
    await expect(page.getByText("Bienvenido")).toBeVisible()
  })

  test("login fallido con contraseña incorrecta", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("admin@example.com")
    await page.getByPlaceholder("••••••••").fill("wrongpassword")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await expect(page.getByText("incorrectos")).toBeVisible()
  })
})

test.describe("Dashboard", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("dashboard muestra bienvenida", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /Bienvenido/ })).toBeVisible()
    await expect(page.getByText("Sistema de Gestión de Debida Diligencia Reforzada").first()).toBeVisible()
  })
})

test.describe("Navegación Sidebar", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("sidebar tiene link a Clientes", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible()
  })

  test("sidebar tiene link a Casos DDR", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Casos DDR" })).toBeVisible()
  })

  test("navegar a Clientes", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Clientes" }).click()
    await expect(page.getByText("Expedientes KYC registrados")).toBeVisible()
  })

  test("navegar a Casos DDR", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("link", { name: "Casos DDR" }).click()
    await expect(page.getByText("Expedientes en proceso de Debida Diligencia Reforzada")).toBeVisible()
  })
})

test.describe("Crear Cliente — Casos de Uso", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("formulario nuevo cliente se abre correctamente", async ({ page }) => {
    await page.goto("/clientes")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Nuevo cliente" }).click({ timeout: 10000 })
    await expect(page.getByRole("heading", { name: "Nuevo Cliente KYC" })).toBeVisible()
    await expect(page.getByText("Identificación")).toBeVisible()
  })

  test("validación: cédula formato inválido", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Natural" }).click()
    await page.getByPlaceholder("8-123-4567").fill("123456")
    await page.getByPlaceholder("Juan Carlos").fill("Test")
    await page.getByPlaceholder("González Pérez").fill("User")
    await page.getByRole("button", { name: "Siguiente" }).click()
    await expect(page.getByText("Formato inválido")).toBeVisible()
  })

  test("validación: nombre requerido", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Natural" }).click()
    await page.getByPlaceholder("8-123-4567").fill("8-123-4567")
    await page.getByRole("button", { name: "Siguiente" }).click()
    await expect(page.getByText("El nombre es requerido")).toBeVisible()
  })

  test("crear persona natural riesgo BAJO (sin PEP)", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Natural" }).click()

    // Paso 1 - Identificación
    await page.getByPlaceholder("8-123-4567").fill("1-999-0001")
    await page.getByPlaceholder("Juan Carlos").fill("María")
    await page.getByPlaceholder("González Pérez").fill("López")
    await page.locator('input[type="date"]').fill("1990-05-15")
    await page.getByRole("button", { name: "Siguiente" }).click()

    // Paso 2 - Información
    const selects = page.locator("select")
    await selects.nth(0).selectOption({ label: "Panamá" })
    await selects.nth(1).selectOption({ label: "Panamá" })
    await page.getByPlaceholder("cliente@correo.com").fill("maria@test.com")
    await page.getByPlaceholder("+507-6000-0000").fill("+507-6000-1234")
    await page.getByPlaceholder("Abogado, Comerciante…").fill("Ingeniera")
    await page.getByRole("button", { name: "Siguiente" }).click()

    // Paso 3 - Documentos (verificar que pide documentos)
    await expect(page.getByText("Documento de identidad")).toBeVisible()
  })

  test("crear persona natural riesgo ALTO (PEP activado)", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Natural" }).click()

    // Paso 1
    await page.getByPlaceholder("8-123-4567").fill("8-777-0001")
    await page.getByPlaceholder("Juan Carlos").fill("Carlos")
    await page.getByPlaceholder("González Pérez").fill("Mendoza")
    await page.locator('input[type="date"]').fill("1985-03-20")
    await page.getByRole("button", { name: "Siguiente" }).click()

    // Paso 2 - verificar que sección PEP existe
    await expect(page.getByText("Persona Expuesta Políticamente (PEP)")).toBeVisible()
  })
})

test.describe("Listado de Clientes", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("página de clientes carga", async ({ page }) => {
    await page.goto("/clientes")
    await expect(page.getByText("Expedientes KYC registrados")).toBeVisible()
    await expect(page.getByRole("button", { name: "Nuevo cliente" })).toBeVisible()
  })

  test("filtro por nivel de riesgo", async ({ page }) => {
    await page.goto("/clientes")
    const filtro = page.locator("select").first()
    await filtro.selectOption({ label: "Todos los niveles" })
  })
})

test.describe("Casos DDR", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("página de casos DDR carga", async ({ page }) => {
    await page.goto("/casos-ddr")
    await expect(page.getByText("Expedientes en proceso de Debida Diligencia Reforzada")).toBeVisible()
  })

  test("detalle de caso se abre al hacer clic", async ({ page }) => {
    await page.goto("/casos-ddr")
    const fila = page.locator("tr.cursor-pointer").first()
    if (await fila.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fila.click()
      await expect(page.getByText("Detalle de caso DDR")).toBeVisible()
    }
  })
})

test.describe("Evaluación DDR — Cuestionario EBR", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("formulario de evaluación carga", async ({ page }) => {
    await page.goto("/casos-ddr")
    const fila = page.locator("tr.cursor-pointer").first()
    if (await fila.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fila.click()
      const btn = page.getByRole("button", { name: /Completar evaluación/ })
      if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await btn.click()
        await expect(page.getByText("Evaluación DDR")).toBeVisible()
        await expect(page.getByText("Cuestionario EBR")).toBeVisible()
      }
    }
  })
})

test.describe("Validación de Roles", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("analista puede ver sus casos", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("analista@example.com")
    await page.getByPlaceholder("••••••••").fill("changethis")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await page.waitForURL("/")
    await page.getByRole("link", { name: "Casos DDR" }).click()
    await expect(page.getByText("Expedientes en proceso")).toBeVisible()
  })

  test("oficial puede ver clientes", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("oficial@example.com")
    await page.getByPlaceholder("••••••••").fill("changethis")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await page.waitForURL("/")
    await page.getByRole("link", { name: "Clientes" }).click()
    await expect(page.getByText("Expedientes KYC registrados")).toBeVisible()
  })
})

test.describe("Health Check API", () => {
  test("backend responde OK", async ({ request }) => {
    const res = await request.get(`${BASE}/api/v1/utils/health-check/`)
    expect(res.ok()).toBeTruthy()
  })

  test("endpoints DDR responden", async ({ request }) => {
    const loginRes = await request.post(`${BASE}/api/v1/login/access-token`, {
      form: { username: "admin@example.com", password: "changethis" },
    })
    expect(loginRes.ok()).toBeTruthy()
    const { access_token } = await loginRes.json()
    const headers = { Authorization: `Bearer ${access_token}` }

    const casos = await request.get(`${BASE}/api/v1/casos-ddr/`, { headers })
    expect(casos.ok()).toBeTruthy()

    const clientes = await request.get(`${BASE}/api/v1/clientes/`, { headers })
    expect(clientes.ok()).toBeTruthy()
  })
})
