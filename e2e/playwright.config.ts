import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/global-setup.ts",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-MX",
  },
  projects: [
    { name: "desktop", testIgnore: /12-cloudnumbering/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testIgnore: /12-cloudnumbering/, use: { ...devices["Pixel 7"] } },
    // Agota el inventario de números: corre al final, cuando ya no hay otras pruebas en paralelo.
    { name: "provisioning", testMatch: /12-cloudnumbering/, dependencies: ["desktop", "mobile"], use: { ...devices["Desktop Chrome"] } },
  ],
});
