import { globSync } from "node:fs";
import pkg from "./package.json" with { type: "json" };
import { extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// @native-html/transient-render-engine declares a react-native peerDependency (only for its
// types), which npm would install for every user if it were a dependency. Bundle it instead.
const bundled = ["@native-html/transient-render-engine"];

export default defineConfig({
  resolve: {
    alias: {
      // see src/htmlparser2.ts
      htmlparser2: fileURLToPath(
        new URL("src/htmlparser2.ts", import.meta.url),
      ),
    },
  },
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
  // for the bundled dependencies, which read it at load time
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [dts({ exclude: ["**/*.{spec,stories}.*", "src/htmlparser2.ts"] })],
});
