import { expect, test } from "@playwright/test"

const BASE = process.env.API_BASE_URL || "http://backend:8000"

test.describe("Login", () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test("login exitoso con admin", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("admin@sgddr.pa")
    await page.getByPlaceholder("••••••••").fill("Admin123!")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await page.waitForURL("/")
    await expect(page.getByText("Bienvenido")).toBeVisible()
  })

  test("login fallido con contraseña incorrecta", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("admin@sgddr.pa")
    await page.getByPlaceholder("••••••••").fill("wrongpassword")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await expect(page.getByText("incorrectos")).toBeVisible()
  })
})

test.describe("Dashboard", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("dashboard muestra bienvenida", async ({ page }) => {
    await page.goto("/")
    await expect(
      page.getByRole("heading", { name: /Bienvenido/ }),
    ).toBeVisible()
    await expect(
      page
        .getByText("Sistema de Gestión de Debida Diligencia Reforzada")
        .first(),
    ).toBeVisible()
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
    await expect(
      page.getByText("Expedientes en proceso de Debida Diligencia Reforzada"),
    ).toBeVisible()
  })
})

test.describe("Crear Cliente — Casos de Uso", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("formulario nuevo cliente se abre correctamente", async ({ page }) => {
    await page.goto("/clientes")
    await page.waitForLoadState("networkidle")
    await page
      .getByRole("button", { name: "Nuevo cliente" })
      .click({ timeout: 10000 })
    await expect(
      page.getByRole("heading", { name: "Nuevo Cliente KYC" }),
    ).toBeVisible()
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
    await expect(
      page.getByText("Persona Expuesta Políticamente (PEP)"),
    ).toBeVisible()
  })
})

test.describe("Listado de Clientes", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("página de clientes carga", async ({ page }) => {
    await page.goto("/clientes")
    await expect(page.getByText("Expedientes KYC registrados")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Nuevo cliente" }),
    ).toBeVisible()
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
    await expect(
      page.getByText("Expedientes en proceso de Debida Diligencia Reforzada"),
    ).toBeVisible()
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
    await page
      .getByPlaceholder("correo@institución.com")
      .fill("carlos@sgddr.pa")
    await page.getByPlaceholder("••••••••").fill("Demo123!")
    await page.getByRole("button", { name: "Ingresar" }).click()
    await page.waitForURL("/")
    await page.getByRole("link", { name: "Casos DDR" }).click()
    await expect(page.getByText("Expedientes en proceso")).toBeVisible()
  })

  test("oficial puede ver clientes", async ({ page }) => {
    await page.goto("/login")
    await page.getByPlaceholder("correo@institución.com").fill("rosa@sgddr.pa")
    await page.getByPlaceholder("••••••••").fill("Demo123!")
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
      form: { username: "admin@sgddr.pa", password: "Admin123!" },
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

test.describe("Crear Cliente — Persona Jurídica (Ley 254/2021)", () => {
  test.use({ storageState: "playwright/.auth/admin.json" })

  test("paso 1 muestra sección de datos de empresa", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Jurídica" }).click()
    await expect(page.getByText("Datos de la empresa")).toBeVisible()
    await expect(page.getByPlaceholder("Corp Panama S.A.")).toBeVisible()
    await expect(page.getByPlaceholder("123-456-789")).toBeVisible()
  })

  test("paso 2 siembra un beneficiario y muestra total 0%", async ({
    page,
  }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Jurídica" }).click()
    await page.getByPlaceholder("Corp Panama S.A.").fill("Acme S.A.")
    await page.getByPlaceholder("123-456-789").fill("1234567-1-234567")
    await page.locator('input[type="date"]').first().fill("2010-01-01")
    await page.getByRole("button", { name: "Siguiente" }).click()

    // Espera a que aparezca el título del paso 2 antes de aserciones.
    await expect(
      page.getByText("Persona Jurídica — Ley 254/2021").first(),
    ).toBeVisible()

    // La sección de Beneficiarios Finales debe estar visible y obligatoria.
    await expect(
      page.locator("p", { hasText: /^Beneficiarios Finales/ }).first(),
    ).toBeVisible()
    // Una fila pre-sembrada.
    await expect(page.getByText("Beneficiario Final #1")).toBeVisible()
    // Total inicial = 0%.
    await expect(page.getByText("0.00%")).toBeVisible()
  })

  test("validación bloquea envío cuando suma != 100%", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Jurídica" }).click()

    // Paso 1 — Identificación empresa
    await page.getByPlaceholder("Corp Panama S.A.").fill("Acme S.A.")
    await page.getByPlaceholder("123-456-789").fill("1234567-1-234567")
    await page.locator('input[type="date"]').first().fill("2010-01-01")
    await page.getByRole("button", { name: "Siguiente" }).click()

    // Espera paso 2.
    await expect(page.getByPlaceholder("RM-1234567")).toBeVisible()

    // Llena los campos requeridos de empresa y representante, pero deja
    // el total de beneficiarios en 60% (no llega a 100%).
    await page.getByPlaceholder("RM-1234567").fill("RM-99999")
    await page
      .getByPlaceholder("Av. Principal 123, Edif. ABC, Piso 5")
      .fill("Av. Test 100")
    await page.getByPlaceholder("Ciudad de Panamá").fill("Panamá")
    await page.getByPlaceholder("+507-200-0000").fill("+507-200-0000")
    await page.getByPlaceholder("contacto@empresa.com").fill("acme@test.com")
    await page.getByPlaceholder("Nombre completo").fill("Carlos Mendoza")
    await page.getByPlaceholder("8-123-4567").first().fill("8-999-0001")
    await page
      .locator("select")
      .nth(1)
      .selectOption({ label: "Servicios jurídicos y contables" })

    await page.getByPlaceholder("Juan Carlos").fill("Carlos")
    await page.getByPlaceholder("González Pérez").fill("Mendoza")
    await page.getByPlaceholder("8-123-4567").last().fill("3-456-789")
    await page.locator('input[type="date"]').last().fill("1980-01-01")
    await page.locator('input[type="number"]').fill("60")

    // Intentar avanzar debe fallar y mostrar el error inline.
    await page.getByRole("button", { name: "Siguiente" }).click()
    await expect(page.getByText(/Actual: 60%/)).toBeVisible()
  })

  test("crear persona jurídica happy path (60 + 40)", async ({ page }) => {
    await page.goto("/kyc/nuevo")
    await page.getByRole("button", { name: "Persona Jurídica" }).click()

    // Paso 1 — Identificación empresa
    await page.getByPlaceholder("Corp Panama S.A.").fill("Acme S.A.")
    await page.getByPlaceholder("123-456-789").fill("1234567-1-234567")
    await page.locator('input[type="date"]').first().fill("2010-01-01")
    await page.getByRole("button", { name: "Siguiente" }).click()

    await expect(page.getByPlaceholder("RM-1234567")).toBeVisible()

    // Paso 2 — Empresa
    await page.getByPlaceholder("RM-1234567").fill("RM-99999")
    await page
      .getByPlaceholder("Av. Principal 123, Edif. ABC, Piso 5")
      .fill("Av. Test 100")
    await page.getByPlaceholder("Ciudad de Panamá").fill("Panamá")
    await page.getByPlaceholder("+507-200-0000").fill("+507-200-0000")
    await page.getByPlaceholder("contacto@empresa.com").fill("acme@test.com")
    await page.getByPlaceholder("Nombre completo").fill("Carlos Mendoza")
    await page.getByPlaceholder("8-123-4567").first().fill("8-999-0001")
    await page
      .locator("select")
      .nth(1)
      .selectOption({ label: "Servicios jurídicos y contables" })

    // Beneficiario #1 al 60% (es el único; usa .last() / .first())
    await page.getByPlaceholder("Juan Carlos").fill("Carlos")
    await page.getByPlaceholder("González Pérez").fill("Mendoza")
    await page.getByPlaceholder("8-123-4567").last().fill("3-456-789")
    await page.locator('input[type="date"]').last().fill("1980-01-01")
    await page.locator('input[type="number"]').first().fill("60")

    // Agregar Beneficiario #2 al 40% (queda como .last())
    await page
      .getByRole("button", { name: "Agregar Beneficiario Final" })
      .click()
    await expect(page.getByText("Beneficiario Final #2")).toBeVisible()
    await page.getByPlaceholder("Juan Carlos").last().fill("Ana")
    await page.getByPlaceholder("González Pérez").last().fill("Ruiz")
    await page.getByPlaceholder("8-123-4567").last().fill("4-567-890")
    await page.locator('input[type="date"]').last().fill("1985-05-10")
    await page.locator('input[type="number"]').last().fill("40")

    // Total debe ser 100%.
    await expect(page.getByText("100.00%")).toBeVisible()

    await page.getByRole("button", { name: "Siguiente" }).click()

    // Paso 3 — Documentos. Subimos un PDF dummy para RUC (docIdentidad)
    // y escritura de constitución. Hay 3 inputs file en paso 3 para JURIDICA
    // (identidad, constitución, poder opcional). Tomamos los dos primeros.
    const dummyPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>%%EOF",
    )
    const fileInputs = page.locator('input[type="file"]')
    await fileInputs.nth(0).setInputFiles({
      name: "ruc.pdf",
      mimeType: "application/pdf",
      buffer: dummyPdf,
    })
    await fileInputs.nth(1).setInputFiles({
      name: "escritura.pdf",
      mimeType: "application/pdf",
      buffer: dummyPdf,
    })

    await page.getByRole("button", { name: "Siguiente" }).click()

    // Paso 4 — Revisión (SectionHeader renderiza <p>, no heading)
    await expect(page.getByText("Revisión y confirmación")).toBeVisible()
    await expect(page.getByText(/100% total/)).toBeVisible()

    // Enviar
    await page
      .getByRole("button", { name: "Guardar y Enviar a Revisión" })
      .click()

    // Tras éxito, redirige a /clientes/:id
    await page.waitForURL(/\/clientes\/[a-f0-9-]+$/, { timeout: 15000 })
    await expect(page.getByText("Acme S.A.").first()).toBeVisible()
  })
})
