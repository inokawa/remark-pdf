import typescript from "@rollup/plugin-typescript";
import { dirname } from 'node:path'
import pkg from "./package.json" with { type: "json" };

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
];

const plugins = [
  typescript({
    tsconfig: "./tsconfig.json",
    outDir: ".",
    declaration: true,
    declarationDir: dirname(pkg.types),
    exclude: ["src/**/*.spec.*"],
  }),
];

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: pkg.exports["."].require,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.exports["."].default,
        format: "es",
        sourcemap: true,
      },
    ],
    external: externals,
    plugins: plugins,
  },
  {
    input: "src/node.ts",
    output: [
      {
        file: pkg.exports["./node"].require,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.exports["./node"].default,
        format: "es",
        sourcemap: true,
      },
    ],
    external: externals,
    plugins: plugins,
  },
];
