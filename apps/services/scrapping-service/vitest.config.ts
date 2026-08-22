import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.spec.ts"],
    exclude: ["tests/integration-real/**"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/controllers/**", "src/routes.ts"],
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
    reporters: ["verbose"],
  },
});
