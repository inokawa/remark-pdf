import typescript from "@rollup/plugin-typescript";
import { dirname } from 'node:path'
import pkg from "./package.json" with { type: "json" };

const publishDir = dirname(pkg.module)

const external = (id) => [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
].some((d) => id.startsWith(d));

export default [
  {
    input: "src/index.ts",
    output: [
      {
        dir: publishDir,
        format: "cjs",
        sourcemap: true,
        entryFileNames: '[name].cjs',
      },
      {
        dir: publishDir,
        format: "es",
        sourcemap: true,
        entryFileNames: '[name].js',
      },
    ],
    external,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "./src",
        outDir: publishDir,
        declaration: true,
        declarationDir: publishDir,
        exclude: ["src/**/*.spec.*"],
      }),
    ],
  },
];
