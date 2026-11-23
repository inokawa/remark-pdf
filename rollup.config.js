import typescript from "@rollup/plugin-typescript";
import resolve from '@rollup/plugin-node-resolve';
import { dirname, extname, relative } from 'node:path'
import pkg from "./package.json" with { type: "json" };
import { fileURLToPath } from "node:url";

const publishDir = dirname(pkg.module);

// @jsamr/counter-style has no `exports` map, so its subpath imports can't be resolved by Node's native ESM loader.
const bundled = ['@jsamr/counter-style'];

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
].filter(d => !bundled.some(b => d.startsWith(b)));

const isExternal = (id) => externals.some((d) => id.startsWith(d));

export default [
  {
    input: Object.fromEntries(
      ["src/index.ts"].map((file) => [
        relative('./src', file.slice(0, file.length - extname(file).length)),
        fileURLToPath(new URL(file, import.meta.url)),
      ]),
    ),
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
    external: isExternal,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "./src",
        outDir: publishDir,
        declaration: true,
        declarationDir: publishDir,
        exclude: ["src/**/*.spec.*"],
      }),
      resolve(),
    ],
  },
];
