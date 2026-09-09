import { defineConfig } from "@playwright/test";
import { isAbsolute } from "node:path";

const build = process.env.QUICKSTART_BUILD;
if (!build || !isAbsolute(build)) {
  throw new Error("QUICKSTART_BUILD must be an absolute quick-start build path");
}

export default defineConfig({
  testDir: "./tests/quickstart",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4176",
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
    command: `python3 -m http.server 4176 --bind 127.0.0.1 --directory ${JSON.stringify(build)}`,
    url: "http://127.0.0.1:4176/",
    reuseExistingServer: false,
  },
});
