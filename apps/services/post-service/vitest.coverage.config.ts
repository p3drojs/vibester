import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/integration/**/*.spec.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "tests/integration-real/**"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/controller/**", "src/routes.ts"],
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
    reporters: ["verbose"],
  },
});
