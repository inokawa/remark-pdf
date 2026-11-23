import pkg from "./package.json" with { type: "json" };
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// @jsamr/counter-style has no `exports` map, so its subpath imports can't be resolved by Node's native ESM loader.
const bundled = ["@jsamr/counter-style"];

export default defineConfig({
  build: {
    outDir: "./lib",
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (f, entryName) => entryName + "." + (f === "es" ? "js" : "cjs"),
    },
    rolldownOptions: {
      external: (id) =>
        [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
        ]
          .filter((d) => !bundled.includes(d))
          .some((d) => id.startsWith(d)),
    },
    sourcemap: true,
  },
  plugins: [dts({ exclude: ["**/*.{spec,stories}.*"] })],
});
