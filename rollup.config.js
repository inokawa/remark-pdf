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
        file: pkg.exports["."].default,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.exports["."].module,
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
        file: pkg.exports["./node"].default,
        format: "cjs",
        sourcemap: true,
      },
      {
        file: pkg.exports["./node"].module,
        format: "es",
        sourcemap: true,
      },
    ],
    external: externals,
    plugins: plugins,
  },
];
