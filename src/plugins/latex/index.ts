import type * as hast from "hast";
import type { InlineMath, Math } from "mdast-util-math";
import { visit } from "unist-util-visit";
import type { RemarkPdfPlugin } from "../../mdast-util-to-pdf";
import { warnOnce } from "../../utils";

type MathNode = InlineMath | Math;

let instanceCount = 0;

// MathJax is imported, also from CommonJS, so that the glyphs it imports on
// demand go into the same instance of its font.
const loadMathJax = async () => {
  const [
    { mathjax },
    { TeX },
    { SVG },
    { liteAdaptor },
    { RegisterHTMLHandler },
    { MathJaxNewcmFont },
  ] = await Promise.all([
    import("@mathjax/src/js/mathjax.js"),
    import("@mathjax/src/js/input/tex.js"),
    import("@mathjax/src/js/output/svg.js"),
    import("@mathjax/src/js/adaptors/liteAdaptor.js"),
    import("@mathjax/src/js/handlers/html.js"),
    import("@mathjax/mathjax-newcm-font/js/svg.js"),
    import("@mathjax/src/js/input/tex/base/BaseConfiguration.js"),
    import("@mathjax/src/js/input/tex/ams/AmsConfiguration.js"),
    import("@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js"),
    import("@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js"),
    import("@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js"),
    import("@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js"),
  ]);
  // https://github.com/mathjax/MathJax-demos-node/blob/master/direct/tex2svg
  const adaptor = liteAdaptor();
  RegisterHTMLHandler(adaptor);
  // The glyphs out of the font's default ranges (\mathbb, \mathcal, …) are
  // loaded on demand.
  mathjax.asyncLoad ??= (name: string) => import(/* @vite-ignore */ name);
  const doc = mathjax.document("", {
    InputJax: new TeX({
      packages: [
        "base",
        "ams",
        "boldsymbol",
        "newcommand",
        "textmacros",
        "unicode",
      ],
    }),
    OutputJax: new SVG({
      // paths of glyphs in each svg, as it is drawn on its own
      fontCache: "none",
      font: new MathJaxNewcmFont(),
      // one svg for each math, which the layout places as a box; MathJax
      // splits in-line math at its breakpoints otherwise
      linebreaks: { inline: false },
    }),
  });
  return { adaptor, doc };
};

/**
 * A plugin to render LaTeX inside "math" and "inlineMath" nodes with
 * [MathJax](https://www.mathjax.org/), as SVG.
 */
export const latexPlugin = (): RemarkPdfPlugin => {
  let mathJax: ReturnType<typeof loadMathJax> | undefined;

  // NUL can't be in urls of Markdown, so the keys don't conflict with images in the document.
  const prefix = `\0latex-${instanceCount++}\0`;
  const keyOf = ({ type, value }: MathNode): string =>
    prefix + (type === "math" ? "$$" : "$") + value;

  return async ({ root, images, readImage }) => {
    const { adaptor, doc } = await (mathJax ??= loadMathJax());

    const nodes: MathNode[] = [];
    visit(root, (node) => {
      if (node.type === "math" || node.type === "inlineMath") {
        nodes.push(node);
      }
    });

    // one at a time, as MathJax converts in its document
    for (const node of nodes) {
      const key = keyOf(node);
      if (images.has(key)) {
        continue;
      }
      images.set(key, null);
      let svg: string;
      try {
        svg = adaptor.innerHTML(
          await doc.convertPromise(node.value, {
            display: node.type === "math",
          }),
        );
        const error = /\sdata-mjx-error="([^"]*)"/.exec(svg)?.[1];
        if (error != null) {
          throw new Error(error);
        }
      } catch (e) {
        warnOnce(
          `Failed to render LaTeX, falling back to text: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }
      const image = await readImage(new TextEncoder().encode(svg), node.value);
      if (image) {
        images.set(key, image);
      }
    }

    const toImage = (node: MathNode): hast.Element | undefined => {
      const src = keyOf(node);
      return images.get(src)
        ? { type: "element", tagName: "img", properties: { src }, children: [] }
        : undefined;
    };

    return {
      // a div, not a p, which a tight list item unwraps
      math: (node) => {
        const image = toImage(node);
        return {
          type: "element",
          tagName: "div",
          properties: { className: [image ? "math" : "raw"] },
          children: [image ?? { type: "text", value: node.value }],
        };
      },
      inlineMath: (node) =>
        toImage(node) ?? { type: "text", value: node.value },
    };
  };
};
