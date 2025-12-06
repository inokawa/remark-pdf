# remark-pdf

![npm](https://img.shields.io/npm/v/remark-pdf) ![npm](https://img.shields.io/npm/dw/remark-pdf) ![check](https://github.com/inokawa/remark-pdf/workflows/check/badge.svg) ![demo](https://github.com/inokawa/remark-pdf/workflows/demo/badge.svg)

> [remark](https://github.com/remarkjs/remark) plugin to compile markdown to pdf.

- Uses [pdfmake](https://github.com/bpampuch/pdfmake) for compilation.
- Works in browser and Node.js.

### 🚧 WIP 🚧

This project is aiming to support all nodes in [mdast](https://github.com/syntax-tree/mdast) syntax tree, but currently transformation and stylings may not be well.

If you have some feature requests or improvements, please create a [issue](https://github.com/inokawa/remark-pdf/issues) or [PR](https://github.com/inokawa/remark-pdf/pulls).

- [x] paragraph
- [x] heading
- [x] thematicBreak
- [ ] blockquote
- [x] list
- [x] listItem
- [x] table
- [x] tableRow
- [x] tableCell
- [ ] html
- [ ] code
- [ ] yaml
- [ ] toml
- [ ] definition
- [ ] footnoteDefinition
- [x] text
- [x] emphasis
- [x] strong
- [x] delete
- [ ] inlineCode
- [x] break
- [x] link
- [x] image
- [ ] linkReference
- [ ] imageReference
- [ ] footnote
- [ ] footnoteReference
- [ ] math
- [ ] inlineMath

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

const processor = unified().use(markdown).use(pdf, { output: "blob" });

const text = "# hello world";

(async () => {
  const doc = await processor.process(text);
  const blob = await doc.result;
  saveAs(blob, "example.pdf");
})();
```

### Node.js

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf/node";
import * as fs from "fs";

const processor = unified().use(markdown).use(pdf, { output: "buffer" });

const text = "# hello world";

(async () => {
  const doc = await processor.process(text);
  const buffer = await doc.result;
  fs.writeFileSync("example.pdf", buffer);
})();
```

#### Example: Custom fonts

Use custom fonts in Node by providing a `fonts` object to configuration, which is a dictionary structured like `fonts[fontName][fontStyle][pathToFontFile]`. Use the fonts by name in your `styles` configurations; the font file will be autoselected based on the chosen `bold` and `italic` style specifications.

Note that variable-width fonts are supported, but the path to the same font file must be supplied for all four font variant styles.

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf/node";
import * as fs from "fs";

const pdfOpts = {
  output: "buffer",
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
