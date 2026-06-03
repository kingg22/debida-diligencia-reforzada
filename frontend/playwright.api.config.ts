import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  testMatch: "api.spec.ts",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },
  projects: [
    {
      name: "api",
      use: { browserName: "chromium" },
    },
  ],
})
