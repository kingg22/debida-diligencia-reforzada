import { expect, test } from "@playwright/test"

const API_BASE = process.env.VITE_API_URL || "http://localhost:8000"
const API = `${API_BASE}/api/v1`

const ADMIN = { email: "admin@panama.com", password: "Admin1234!" }
const TEST_USER = {
  email: `test_pw_${Date.now()}@example.com`,
  password: "Test1234!",
  full_name: "Test User Playwright",
}

let adminToken = ""
let testUserToken = ""
let testUserId = ""
let testItemId = ""

test.describe
  .serial("API Tests — PanamaCompliance SGDDR", () => {
    // ── Health Check ──────────────────────────────────────────────
    test("1. GET /utils/health-check/", async ({ request }) => {
      const res = await request.get(`${API}/utils/health-check/`)
      expect(res.ok()).toBeTruthy()
      expect(await res.text()).toContain("true")
    })

    // ── Login ─────────────────────────────────────────────────────
    test("2. POST /login/access-token — credenciales válidas", async ({
      request,
    }) => {
      const res = await request.post(`${API}/login/access-token`, {
        form: { username: ADMIN.email, password: ADMIN.password },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body).toHaveProperty("access_token")
      expect(body.token_type).toBe("bearer")
      adminToken = body.access_token
    })

    test("3. POST /login/access-token — contraseña incorrecta", async ({
      request,
    }) => {
      const res = await request.post(`${API}/login/access-token`, {
        form: { username: ADMIN.email, password: "wrongpassword" },
      })
      expect(res.status()).toBe(400)
      expect((await res.json()).detail).toContain("Incorrect email or password")
    })

    test("4. POST /login/access-token — usuario inexistente", async ({
      request,
    }) => {
      const res = await request.post(`${API}/login/access-token`, {
        form: { username: "noexiste@test.com", password: "Test1234!" },
      })
      expect(res.status()).toBe(400)
    })

    // ── Signup ────────────────────────────────────────────────────
    test("5. POST /users/signup — crea usuario nuevo", async ({ request }) => {
      const res = await request.post(`${API}/users/signup`, { data: TEST_USER })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.email).toBe(TEST_USER.email)
      expect(body.full_name).toBe(TEST_USER.full_name)
      expect(body.is_active).toBe(true)
      expect(body.is_superuser).toBe(false)
      testUserId = body.id
    })

    test("6. POST /users/signup — email duplicado retorna 400", async ({
      request,
    }) => {
      const res = await request.post(`${API}/users/signup`, { data: TEST_USER })
      expect(res.status()).toBe(400)
      expect((await res.json()).detail).toContain("already exists")
    })

    // ── Login as test user ────────────────────────────────────────
    test("7. POST /login/access-token — usuario de prueba", async ({
      request,
    }) => {
      const res = await request.post(`${API}/login/access-token`, {
        form: { username: TEST_USER.email, password: TEST_USER.password },
      })
      expect(res.ok()).toBeTruthy()
      testUserToken = (await res.json()).access_token
    })

    // ── Users ─────────────────────────────────────────────────────
    test("8. GET /users/me — usuario actual (admin)", async ({ request }) => {
      const res = await request.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.email).toBe(ADMIN.email)
      expect(body.is_superuser).toBe(true)
    })

    test("9. GET /users/me — sin token retorna 401/403", async ({
      request,
    }) => {
      const res = await request.get(`${API}/users/me`)
      expect([401, 403]).toContain(res.status())
    })

    test("10. GET /users/ — listar usuarios (admin)", async ({ request }) => {
      const res = await request.get(`${API}/users/`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body).toHaveProperty("data")
      expect(body).toHaveProperty("count")
      expect(body.count).toBeGreaterThan(0)
    })

    test("11. PATCH /users/me — actualizar nombre", async ({ request }) => {
      const res = await request.patch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
        data: { full_name: "Updated Name" },
      })
      expect(res.ok()).toBeTruthy()
      expect((await res.json()).full_name).toBe("Updated Name")
    })

    test("12. PATCH /users/me/password — cambiar contraseña", async ({
      request,
    }) => {
      const res = await request.patch(`${API}/users/me/password`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
        data: {
          current_password: TEST_USER.password,
          new_password: "NewTest1234!",
        },
      })
      expect(res.ok()).toBeTruthy()
      expect((await res.json()).message).toContain("Password updated")
      TEST_USER.password = "NewTest1234!"
    })

    test("13. GET /users/{id} — obtener usuario por ID", async ({
      request,
    }) => {
      const res = await request.get(`${API}/users/${testUserId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.ok()).toBeTruthy()
      expect((await res.json()).id).toBe(testUserId)
    })

    // ── Items ─────────────────────────────────────────────────────
    test("14. POST /items/ — crear item", async ({ request }) => {
      const res = await request.post(`${API}/items/`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
        data: { title: "Item de prueba", description: "Descripción test" },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.title).toBe("Item de prueba")
      expect(body.description).toBe("Descripción test")
      expect(body).toHaveProperty("id")
      testItemId = body.id
    })

    test("15. GET /items/ — listar items", async ({ request }) => {
      const res = await request.get(`${API}/items/`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.data.length).toBeGreaterThan(0)
    })

    test("16. GET /items/{id} — obtener item por ID", async ({ request }) => {
      const res = await request.get(`${API}/items/${testItemId}`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.id).toBe(testItemId)
      expect(body.title).toBe("Item de prueba")
    })

    test("17. PUT /items/{id} — actualizar item", async ({ request }) => {
      const res = await request.put(`${API}/items/${testItemId}`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
        data: { title: "Item actualizado", description: "Nueva desc" },
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.title).toBe("Item actualizado")
    })

    test("18. DELETE /items/{id} — eliminar item", async ({ request }) => {
      const res = await request.delete(`${API}/items/${testItemId}`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      })
      expect(res.ok()).toBeTruthy()

      const getRes = await request.get(`${API}/items/${testItemId}`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      })
      expect(getRes.status()).toBe(404)
    })

    test("19. GET /items/{id} — 404 para item inexistente", async ({
      request,
    }) => {
      const fakeId = "00000000-0000-0000-0000-000000000000"
      const res = await request.get(`${API}/items/${fakeId}`, {
        headers: { Authorization: `Bearer ${testUserToken}` },
      })
      expect(res.status()).toBe(404)
    })

    // ── Cleanup ───────────────────────────────────────────────────
    test("20. DELETE /users/{id} — eliminar usuario de prueba", async ({
      request,
    }) => {
      const res = await request.delete(`${API}/users/${testUserId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(res.ok()).toBeTruthy()

      const getRes = await request.get(`${API}/users/${testUserId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      expect(getRes.status()).toBe(404)
    })
  })
