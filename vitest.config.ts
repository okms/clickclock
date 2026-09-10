import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["core/**/*.test.ts", "app/**/*.test.ts"],
    environment: "node",
  },
});
