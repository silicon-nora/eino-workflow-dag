import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/host",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: "http://127.0.0.1:4175",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: "npm run dev --prefix examples/rc-host -- --host 127.0.0.1 --port 4175 --force",
    url: "http://127.0.0.1:4175/",
    reuseExistingServer: !process.env.CI,
  },
});
