import { globSync } from "node:fs";
import pkg from "./package.json" with { type: "json" };
import { extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// @jsamr/counter-style has no `exports` map, so its subpath imports can't be resolved by Node's native ESM loader.
const bundled = ["@jsamr/counter-style"];

export default defineConfig({
  build: {
    outDir: "./lib",
    lib: {
      entry: Object.fromEntries(
        ["src/index.ts", ...globSync("src/plugins/*/index.ts")].map((file) => [
          relative("./src", file.slice(0, file.length - extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ]),
      ),
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
