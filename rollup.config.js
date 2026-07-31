import typescript from "@rollup/plugin-typescript";
import resolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
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

const AFM_FONTS = [
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
];

const inlinedAssets = AFM_FONTS.reduce((acc, k) => {
  acc[readFontStr(k)] = injectString(k);
  return acc;
}, {
  ["fs.readFileSync(`${__dirname}/data/sRGB_IEC61966_2_1.icc`)"]: injectString("/data/sRGB_IEC61966_2_1.icc", true)
});

// `replace` is a plain string match that silently no-ops if pdfkit changes how it
// spells these calls, which would only surface as a browser crash at runtime.
const pdfkitSource = readFileSync(import.meta.dirname + '/node_modules/pdfkit/' + pdfkitPkg.module, 'utf8');
for (const key of Object.keys(inlinedAssets)) {
  if (!pdfkitSource.includes(key)) {
    throw new Error(
      `pdfkit@${pdfkitPkg.version}/${pdfkitPkg.module} no longer contains \`${key}\`. ` +
      `Update the inlining table in rollup.config.js.`
    )
  }
}

const assertInlinedAssets = () => ({
  name: 'assert-inlined-assets',
  generateBundle(_options, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type !== 'chunk' || file.name !== 'index') continue;
      const fonts = file.code.match(/StartFontMetrics/g)?.length ?? 0;
      if (fonts !== AFM_FONTS.length) {
        throw new Error(`${file.fileName}: expected ${AFM_FONTS.length} inlined afm fonts, found ${fonts}`)
      }
      if (file.code.includes('__dirname')) {
        throw new Error(`${file.fileName}: still reads pdfkit data from disk via __dirname`)
      }
    }
  },
});

for (const [k, v] of Object.entries(pdfkitPkg.dependencies).filter(([p]) => p !== 'png-js')) {
  const dep = pkg.dependencies[k];
  if (!dep || dep !== v) {
    throw new Error(`${pkg.name} doesn't have ${k}@${v} in dependencies`)
  }
}

// Inlined rather than left external, so `replace` and `alias` can reach their source.
const bundled = ['pdfkit', 'png-js'];

const externals = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.devDependencies),
  ...Object.keys(pkg.imports),
  ...Object.keys(pdfkitPkg.dependencies)
].filter(d => !bundled.some(b => d.startsWith(b)));

const isExternal = (id) => externals.some((d) => id.startsWith(d));

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
    external: isExternal,
    plugins: [
      replace(inlinedAssets),
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
      // Without `node`, png-js resolves to its browser build, which bundles browserify-zlib.
      resolve({ exportConditions: ["node"] }),
      assertInlinedAssets(),
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
    external: isExternal,
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
