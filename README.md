# remark-pdf

![npm](https://img.shields.io/npm/v/remark-pdf) ![npm](https://img.shields.io/npm/dw/remark-pdf) ![check](https://github.com/inokawa/remark-pdf/workflows/check/badge.svg) ![demo](https://github.com/inokawa/remark-pdf/workflows/demo/badge.svg)

> [remark](https://github.com/remarkjs/remark) plugin to compile markdown to pdf.

- Uses [pdfkit](https://github.com/foliojs/pdfkit) for compilation, to avoid issues with puppeteer or headless chromium.
- Works in any environment (e.g. browser, Node.js).

### Supported [mdast](https://github.com/syntax-tree/mdast) nodes

Currently, some of the default styles may not be nice. If you have some feature requests or improvements, please create a [issue](https://github.com/inokawa/remark-pdf/issues) or [PR](https://github.com/inokawa/remark-pdf/pulls).

- [x] paragraph
- [x] heading
- [x] thematicBreak
- [x] blockquote
- [x] list / listItem
- [x] table / tableRow / tableCell
- [x] definition
- [x] text
- [x] emphasis
- [x] strong
- [x] delete
- [x] inlineCode
- [x] break
- [x] link / linkReference
- [ ] footnoteReference / footnoteDefinition
- [x] image / imageReference
- [ ] html
- [x] code
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
  saveAs(new Blob([arrayBuffer], { type: "application/pdf" }), "example.pdf");
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

Use custom fonts in Node by providing a `fonts` object to configuration. Use the fonts by name in your `styles` configurations; the font file will be autoselected based on the chosen `bold` and `italic` style specifications.

Note that variable-width fonts are supported, but the path to the same font file must be supplied for all four font variant styles.

```javascript
import { unified } from "unified";
import markdown from "remark-parse";
import pdf from "remark-pdf";
import * as fs from "fs";

const processor = unified()
  .use(markdown)
  .use(pdf, {
    fonts: [
      {
        name: "National Park",
        normal: fs.readFileSync("/path/to/fonts/nationalpark-variablevf.ttf"),
        bold: fs.readFileSync("/path/to/fonts/nationalpark-variablevf.ttf"),
        italic: fs.readFileSync("/path/to/fonts/nationalpark-variablevf.ttf"),
        bolditalic: fs.readFileSync(
          "/path/to/fonts/nationalpark-variablevf.ttf",
        ),
      },
      {
        name: "Merriweather Sans",
        normal: fs.readFileSync("/path/to/fonts/merriweathersans-light.ttf"),
        bold: fs.readFileSync("/path/to/fonts/merriweathersans-bold.ttf"),
        italic: fs.readFileSync("/path/to/fonts/merriweathersans-italic.ttf"),
        bolditalic: fs.readFileSync(
          "/path/to/fonts/merriweathersans-bolditalic.ttf",
        ),
      },
    ],
    styles: {
      default: { font: "Merriweather Sans", italic: true },
      head1: {
        bold: true,
        font: "National Park",
        fontSize: 24,
      },
    },
  });

const text = `
# Header in National Park bold

Body text in Merriweather Sans Italic
`;

(async () => {
  const doc = await processor.process(text);
  const arrayBuffer = await doc.result;
  fs.writeFileSync("example.pdf", Buffer.from(arrayBuffer));
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
