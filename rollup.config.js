import typescript from "@rollup/plugin-typescript";
import pkg from "./package.json";

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
];

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
        sourcemap: true,
      },
      {
        file: pkg.module,
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
        file: "lib/node.mjs",
        format: "cjs",
      },
      {
        file: "lib/node.js",
        format: "es",
      },
    ],
    external: externals,
    plugins: plugins,
  },
];
