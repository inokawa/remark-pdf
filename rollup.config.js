import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";

const plugins = [
  typescript({
    tsconfig: "./tsconfig.json",
    outDir: ".",
    declaration: true,
    exclude: ["src/**/*.spec.*"],
  }),
];

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.main,
        format: "cjs",
      },
      {
        file: pkg.module,
        format: "es",
      },
    ],
    external: Object.keys(pkg.dependencies),
    plugins: plugins,
  },
  {
    input: "src/node.ts",
    output: [
      {
        file: "lib/node.mjs",
        format: "cjs",
      },
      {
        file: "lib/node.js",
        format: "es",
      },
    ],
    external: Object.keys(pkg.dependencies),
    plugins: plugins,
  },
];
