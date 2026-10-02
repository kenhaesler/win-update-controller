import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:1421",
    viewport: { width: 1280, height: 850 },
    colorScheme: "dark",
  },
  webServer: {
    command: "npm run dev -- --port 1421",
    url: "http://127.0.0.1:1421",
    reuseExistingServer: false,
  },
  reporter: "list",
});
