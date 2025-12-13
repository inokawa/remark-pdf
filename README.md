# remark-pdf

![npm](https://img.shields.io/npm/v/remark-pdf) ![npm](https://img.shields.io/npm/dw/remark-pdf) ![check](https://github.com/inokawa/remark-pdf/workflows/check/badge.svg) ![demo](https://github.com/inokawa/remark-pdf/workflows/demo/badge.svg)

> [remark](https://github.com/remarkjs/remark) plugin to compile markdown to pdf.

- Uses [pdfmake](https://github.com/bpampuch/pdfmake) for compilation, to avoid issues with puppeteer or headless chromium.
- Works in any environment (e.g. browser, Node.js).

### 🚧 WIP 🚧

This project is aiming to support all nodes in [mdast](https://github.com/syntax-tree/mdast) syntax tree, but currently transformation and stylings may not be well.

If you have some feature requests or improvements, please create a [issue](https://github.com/inokawa/remark-pdf/issues) or [PR](https://github.com/inokawa/remark-pdf/pulls).

- [x] paragraph
- [x] heading
- [x] thematicBreak
- [ ] blockquote
- [x] list / listItem
- [x] table / tableRow / tableCell
- [x] definition
- [x] text
- [x] emphasis
- [x] strong
- [x] delete
- [ ] inlineCode
- [x] break
- [x] link / linkReference
- [ ] footnote / footnoteReference / footnoteDefinition
- [ ] image / imageReference
- [ ] html
- [ ] code
- [ ] math / inlineMath

## Demo

https://inokawa.github.io/remark-pdf/

## Install

```sh
npm install remark-pdf
```

## Usage

### Browser

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf";
import { saveAs } from "file-saver";

const processor = unified().use(markdown).use(pdf);

const text = "# hello world";

(async () => {
  const doc = await processor.process(text);
  const arrayBuffer = await doc.result;
  saveAs(new Blob([arrayBuffer]), "example.pdf");
})();
```

### Node.js

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf";
import * as fs from "fs";

const processor = unified().use(markdown).use(pdf);

const text = "# hello world";

(async () => {
  const doc = await processor.process(text);
  const arrayBuffer = await doc.result;
  fs.writeFileSync("example.pdf", Buffer.from(arrayBuffer));
})();
```

#### Example: Custom fonts

Use custom fonts in Node by providing a `fonts` object to configuration, which is a dictionary structured like `fonts[fontName][fontStyle][pathToFontFile]`. Use the fonts by name in your `styles` configurations; the font file will be autoselected based on the chosen `bold` and `italic` style specifications.

Note that variable-width fonts are supported, but the path to the same font file must be supplied for all four font variant styles.

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf";
import * as fs from "fs";

const pdfOpts = {
  fonts: {
    "National Park": {
      normal: "/path/to/fonts/nationalpark-variablevf.ttf",
      bold: "/path/to/fonts/nationalpark-variablevf.ttf",
      italics: "/path/to/fonts/nationalpark-variablevf.ttf",
      bolditalics: "/path/to/fonts/nationalpark-variablevf.ttf",
    },
    "Merriweather Sans": {
      normal: "/path/to/fonts/merriweathersans-light.ttf",
      bold: "/path/to/fonts/merriweathersans-bold.ttf",
      italics: "/path/to/fonts/merriweathersans-italic.ttf",
      bolditalics: "/path/to/fonts/merriweathersans-bolditalic.ttf",
    },
  },
  defaultStyle: { font: "Merriweather Sans", italics: true },
  styles: {
    head1: {
      bold: true,
      font: "National Park",
      fontSize: 24,
    },
  },
};
const processor = unified().use(markdown).use(pdf, pdfOpts);

const text = `
# Header in National Park bold

Body text in Merriweather Sans Italic
`;

(async () => {
  const doc = await processor.process(text);
  const buffer = await doc.result;
  fs.writeFileSync("example.pdf", buffer);
})();
```

## Documentation

- [API reference](./docs/API.md)

## Contribute

All contributions are welcome.
If you find a problem, feel free to create an [issue](https://github.com/inokawa/remark-pdf/issues) or a [PR](https://github.com/inokawa/remark-pdf/pulls).

### Making a Pull Request

1. Fork this repo.
2. Run `npm install`.
3. Commit your fix.
4. Add tests to cover the fix.
5. Make a PR and confirm all the CI checks passed.

## Related projects

- [remark-slate-transformer](https://github.com/inokawa/remark-slate-transformer)
- [remark-docx](https://github.com/inokawa/remark-docx)
