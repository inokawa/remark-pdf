import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: "src",
    clearMocks: true,
    setupFiles: ["jest-date-mock"],
  },
});
