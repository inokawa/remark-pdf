import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";

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
    plugins: [typescript()],
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
    plugins: [typescript()],
  },
];
