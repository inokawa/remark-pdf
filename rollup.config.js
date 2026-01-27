import typescript from "@rollup/plugin-typescript";
import resolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import { dirname, extname, relative } from 'node:path'
import pkg from "./package.json" with { type: "json" };
import pdfkitPkg from "pdfkit/package.json" with { type: "json" };
import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const readFontStr = (fontPath) => {
  return "fs.readFileSync(__dirname + '" + fontPath + "', 'utf8')"
}
const injectString = (fontPath, isBase64) => {
  const font = readFileSync(import.meta.dirname + '/node_modules/pdfkit/js' + fontPath);
  if (isBase64) {
    return "Buffer.from('" + Buffer.from(font).toString('base64') + "', 'base64')";
  }
  return "`" + Buffer.from(font).toString() + "`";
}

const publishDir = dirname(pkg.module);

for (const [k, v] of Object.entries(pdfkitPkg.dependencies).filter(([p]) => p !== 'png-js')) {
  const dep = pkg.dependencies[k];
  if (!dep || dep !== v) {
    throw new Error(`${pkg.name} doesn't have ${k}@${v} in dependencies`)
  }
}

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
  ...Object.keys(pkg.imports),
  ...Object.keys(pdfkitPkg.dependencies)
].filter(d => !d.startsWith('pdfkit') && !d.startsWith('png-js'));

const hasBuffer = (id) => id === 'index';

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
        banner: (c) => hasBuffer(c.name) ? 'const { Buffer } = require("#buffer");' : ''
      },
      {
        dir: publishDir,
        format: "es",
        sourcemap: true,
        entryFileNames: '[name].js',
        banner: (c) => hasBuffer(c.name) ? 'import { Buffer } from "#buffer";' : ''
      },
    ],
    external: (id) => externals.filter(d => d !== 'events').some((d) => id.startsWith(d)),
    plugins: [
      replace(
        [
          '/data/Courier.afm',
          '/data/Courier-Bold.afm',
          '/data/Courier-Oblique.afm',
          '/data/Courier-BoldOblique.afm',
          '/data/Helvetica.afm',
          '/data/Helvetica-Bold.afm',
          '/data/Helvetica-Oblique.afm',
          '/data/Helvetica-BoldOblique.afm',
          '/data/Times-Roman.afm',
          '/data/Times-Bold.afm',
          '/data/Times-Italic.afm',
          '/data/Times-BoldItalic.afm',
          '/data/Symbol.afm',
          '/data/ZapfDingbats.afm',
        ].reduce((acc, k) => {
          acc[readFontStr(k)] = injectString(k);
          return acc;
        }, {
          ["fs.readFileSync(`${__dirname}/data/sRGB_IEC61966_2_1.icc`)"]: injectString("/data/sRGB_IEC61966_2_1.icc", true)
        })
      ),
      alias({
        entries: Object.keys(pkg.imports).map(k => ({
          find: k.slice(1), replacement: k,
        })),
      }),
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "./src",
        outDir: publishDir,
        declaration: true,
        declarationDir: publishDir,
        exclude: ["src/**/*.spec.*"],
      }),
      resolve(),
      commonjs(),
    ],
  }, {
    input: Object.fromEntries(
      globSync('src/shim/*/{browser,node}.ts')
        .map((file) => [
          relative('./src', file.slice(0, file.length - extname(file).length)),
          fileURLToPath(new URL(file, import.meta.url)),
        ]),
    ),
    output: [
      // {
      //   dir: publishDir,
      //   format: "cjs",
      //   sourcemap: true,
      //   entryFileNames: '[name].cjs',
      // },
      {
        dir: publishDir,
        format: "es",
        sourcemap: true,
        entryFileNames: '[name].js',
      },
    ],
    external: (id) => externals.some((d) => id.startsWith(d)),
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        rootDir: "./src",
        outDir: publishDir,
        // declaration: true,
        declarationDir: publishDir,
        exclude: ["src/**/*.spec.*"],
      }),
    ],
  },
];
