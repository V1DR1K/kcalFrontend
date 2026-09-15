import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./output/playwright/test-results",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-desktop", use: { browserName: "webkit", viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false } },
    { name: "webkit-desktop-large", use: { browserName: "webkit", viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false } },
    { name: "webkit-iphone", use: { ...devices["iPhone 13"] } },
    { name: "webkit-iphone-short", testMatch: /safari-responsive\.spec\.js/, use: { ...devices["iPhone 13"], viewport: { width: 390, height: 430 } } },
    { name: "webkit-iphone-landscape", use: { ...devices["iPhone 13"], viewport: { width: 844, height: 390 } } },
    { name: "webkit-ipad", use: { ...devices["iPad Pro 11"], viewport: { width: 1024, height: 1366 } } },
  ],
  webServer: { command: "npm run preview -- --host 127.0.0.1", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
  reporter: process.env.CI ? "github" : "list",
});
