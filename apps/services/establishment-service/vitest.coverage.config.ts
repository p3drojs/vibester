import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/services/**", "src/controllers/**", "src/routes.ts"],
      reporter: ["text", "json-summary", "html", "lcov"],
      thresholds: { lines: 70, functions: 70, branches: 60 },
    },
    projects: [
      {
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts", "tests/**/*.spec.ts"],
          exclude: ["tests/integration-real/**"],
          setupFiles: ["tests/setup/vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          include: ["tests/integration/**/*.spec.ts"],
          setupFiles: ["tests/setup/vitest.integration.setup.ts"],
          testTimeout: 30000,
          hookTimeout: 30000,
          sequence: { concurrent: false },
        },
      },
    ],
  },
});
