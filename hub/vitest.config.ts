import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: { "@exam-rendering": path.resolve(__dirname, "../shared/exam-rendering") },
  },
});
