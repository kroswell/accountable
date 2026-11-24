import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:5173", channel: "chrome", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    env: { ACCOUNTABLE_DB_PATH: path.resolve("test-results", "accountable-e2e.db") },
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"] } }],
});
