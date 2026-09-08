import { defineConfig } from "@playwright/test";
import { isAbsolute } from "node:path";

const build = process.env.RC_VALIDATION_BUILD;
if (!build || !isAbsolute(build)) {
  throw new Error("RC_VALIDATION_BUILD must be an absolute browser-consumer build path");
}

export default defineConfig({
  testDir: "./tests/rc",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4174",
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
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: `python3 -m http.server 4174 --bind 127.0.0.1 --directory ${JSON.stringify(build)}`,
    url: "http://127.0.0.1:4174/",
    reuseExistingServer: false,
  },
});
