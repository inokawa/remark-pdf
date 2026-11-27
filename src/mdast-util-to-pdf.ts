import type * as mdast from "mdast";
import type { VFile } from "vfile";
// @ts-expect-error @types/pdfkit doesn't know `registerStdFonts`
import PDFDocument, { registerStdFonts } from "pdfkit";
import { toBytes } from "pdfkit/output";
import Courier from "pdfkit/standard-fonts/Courier";
import CourierBold from "pdfkit/standard-fonts/CourierBold";
import CourierBoldOblique from "pdfkit/standard-fonts/CourierBoldOblique";
import CourierOblique from "pdfkit/standard-fonts/CourierOblique";
import Helvetica from "pdfkit/standard-fonts/Helvetica";
import HelveticaBold from "pdfkit/standard-fonts/HelveticaBold";
import HelveticaBoldOblique from "pdfkit/standard-fonts/HelveticaBoldOblique";
import HelveticaOblique from "pdfkit/standard-fonts/HelveticaOblique";
import SymbolFont from "pdfkit/standard-fonts/Symbol";
import TimesBold from "pdfkit/standard-fonts/TimesBold";
import TimesBoldItalic from "pdfkit/standard-fonts/TimesBoldItalic";
import TimesItalic from "pdfkit/standard-fonts/TimesItalic";
import TimesRoman from "pdfkit/standard-fonts/TimesRoman";
import ZapfDingbats from "pdfkit/standard-fonts/ZapfDingbats";
// @ts-expect-error
import SVGtoPDF from "svg-to-pdfkit";
import Decimal from "@jsamr/counter-style/presets/decimal";
import Disc from "@jsamr/counter-style/presets/disc";
import { definitions, type GetDefinition } from "mdast-util-definitions";
import deepmerge from "deepmerge";
import { toArrayBuffer, warnOnce, type ToPngFn } from "./utils";
import { imageSize } from "image-size";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import GithubSlugger from "github-slugger";
import {
  layoutBlock,
  type Alignment,
  type BlockBox,
  type ImageBox,
  type LayoutBox,
  type RuleBox,
  type TextBox,
} from "./layout";

// pdfkit's browser build requires standard fonts to be registered. Registering them also keeps
// the Node build working when it is bundled. https://github.com/foliojs/pdfkit/issues/1801
registerStdFonts(
  Courier,
  CourierBold,
  CourierBoldOblique,
  CourierOblique,
  Helvetica,
  HelveticaBold,
  HelveticaBoldOblique,
  HelveticaOblique,
  SymbolFont,
  TimesBold,
  TimesBoldItalic,
  TimesItalic,
  TimesRoman,
  ZapfDingbats,
);

type KnownNodeType = mdast.RootContent["type"];

type MdastNode<T extends string> = T extends KnownNodeType
  ? Extract<mdast.RootContent, { type: T }>
  : unknown;

export type NodeBuilder<T extends string> = (
  node: MdastNode<T>,
  ctx: Context,
) => PdfLayout | PdfLayout[] | null;

export type NodeBuilders = {
  [K in KnownNodeType]?: NodeBuilder<K>;
};

export type RemarkPdfPlugin = (
  ctx: Readonly<{
    root: mdast.Root;
    images: Map<string, PdfImageData | null>;
    readImage: (
      data: ArrayBuffer | Uint8Array,
      name: string,
    ) => Promise<PdfImageData | undefined>;
  }>,
) => Promise<NodeBuilders>;

type StandardFontType =
  "Courier" | "Helvetica" | "Symbol" | "Times" | "ZapfDingbats";

type FontBuffer = ArrayBuffer | Uint8Array;

type RegisteredFont = {
  normal: string;
  bold?: string;
  italic?: string;
  bolditalic?: string;
};

/**
 * Custom font definition.
 */
export interface CustomFont {
  name: string;
  normal: FontBuffer;
  bold?: FontBuffer;
  italic?: FontBuffer;
  bolditalic?: FontBuffer;
}

export type TextStyleMatcher = [pattern: RegExp, style: Partial<TextStyle>];

interface BlockStyle {
  indent?: number;
  display: "block" | "table" | "table-row" | "table-cell";
  textAlign?: Alignment;
}
export interface BlockNode {
  type: "block";
  style: BlockStyle;
  children: PdfLayout[];
}

interface PageBreakNode {
  type: "pagebreak";
}

export interface HorizontalRuleNode {
  type: "hr";
  style: {
    color: string;
    thickness: number;
    margin: number;
  };
}

export interface TextNode {
  type: "text";
  text: string;
  style: TextStyle;
  attrs: {
    link?: string;
    goTo?: string;
    heading?: HeadingAnchor;
  };
}

export interface VoidNode {
  type: "void";
  tag: "image";
  attrs: {
    src: string;
    heading?: HeadingAnchor;
  };
}

interface HeadingAnchor {
  destination: string;
  depth: number;
  title: string;
}

export type PdfLayout =
  BlockNode | PageBreakNode | HorizontalRuleNode | TextNode | VoidNode;

type ListContext = Readonly<{
  level: number;
  meta: Readonly<
    | {
        type: "bullet";
      }
    | {
        type: "ordered";
        number: number;
      }
    | {
        type: "task";
        checked: boolean;
      }
  >;
}>;

interface TextStyle {
  fontSize: number;
  font: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

interface StyleOption {
  head1: Partial<TextStyle>;
  head2: Partial<TextStyle>;
  head3: Partial<TextStyle>;
  head4: Partial<TextStyle>;
  head5: Partial<TextStyle>;
  head6: Partial<TextStyle>;
  link: Partial<TextStyle>;
  inlineCode: Partial<TextStyle>;
  code: Partial<TextStyle>;
  blockquote: Partial<TextStyle>;
}

export type PdfImageData = Readonly<
  {
    // the natural size, as shown, in pt
    width: number;
    height: number;
  } & (
    | {
        type: "png" | "jpg";
        data: ArrayBuffer;
      }
    | {
        type: "svg";
        data: string;
      }
  )
>;

export type Context = Readonly<{
  render: (node: readonly mdast.RootContent[], ctx?: Context) => PdfLayout[];
  /**
   * @internal
   */
  style: TextStyle;
  /**
   * @internal
   */
  textStyle: TextStyleMatcher[];
  /**
   * @internal
   */
  config: StyleOption;
  /**
   * @internal
   */
  thematicBreak: ThematicBreakStyle;
  /**
   * @internal
   */
  list?: ListContext;
  /**
   * @internal
   */
  link?: string;
  /**
   * @internal
   */
  goTo?: string;
  /**
   * @internal
   */
  definition: GetDefinition;
  /**
   * @internal
   */
  destinations: ReadonlyMap<mdast.Heading | string, string>;
  /**
   * @internal
   */
  images: ReadonlyMap<string, PdfImageData | null>;
}>;

/**
 * How thematic break (`---`) is rendered.
 */
export type ThematicBreakStyle = "line" | "pagebreak";

type LoadFn = (url: string, file: VFile) => Promise<ArrayBuffer | Uint8Array>;

const loadWithFetch: LoadFn = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
};

export interface ImageOptions {
  /**
   * A function to resolve image data from url. `file` is the processed file, which can be used to resolve relative urls.
   * @default {@link loadWithFetch}
   */
  load?: LoadFn;
  /**
   * A function to convert images to PNG. Required to embed images other than PNG, JPEG and SVG, such as GIF and WebP.
   * On browser, you can use {@link browserToPng}.
   */
  toPng?: ToPngFn;
}

/**
 * @internal
 */
export type ImageCache = Map<string, PdfImageData>;

const MAX_CACHE_SIZE = 100;

// the natural size of an image is in CSS px, which is 1/96 in
const PX_TO_PT = 72 / 96;

const loadImage = async (
  url: string,
  file: VFile,
  load: LoadFn,
  toPng: ToPngFn | undefined,
): Promise<PdfImageData | undefined> => {
  let data: ArrayBuffer;
  try {
    data = toArrayBuffer(await load(url, file));
  } catch (e) {
    warnOnce(`Failed to load image: ${url} ${e}`);
    return;
  }
  return readImage(data, toPng, url);
};

const readImage = async (
  data: ArrayBuffer,
  toPng: ToPngFn | undefined,
  name: string,
): Promise<PdfImageData | undefined> => {
  let size: ReturnType<typeof imageSize>;
  try {
    size = imageSize(new Uint8Array(data));
  } catch (e) {
    warnOnce(`Failed to detect image type: ${name} ${e}`);
    return;
  }
  const type = size.type!;
  let { width, height } = size;
  if (!width || !height) {
    // an svg without a size of its own
    warnOnce(`Failed to load image: ${name} has no size`);
    return;
  }
  if (type === "png" || type === "jpg") {
    if (size.orientation != null && size.orientation > 4) {
      // shown rotated by 90 degrees, as pdfkit draws it
      [width, height] = [height, width];
    }
    return {
      type,
      width: width * PX_TO_PT,
      height: height * PX_TO_PT,
      data,
    };
  }
  if (type === "svg") {
    return {
      type,
      width: width * PX_TO_PT,
      height: height * PX_TO_PT,
      data: new TextDecoder().decode(data),
    };
  }
  if (!toPng) {
    warnOnce(`toPng option is required to embed ${type}: ${name}`);
    return;
  }
  let png: ArrayBuffer;
  try {
    png = toArrayBuffer(await toPng({ buffer: data, width, height }));
  } catch (e) {
    warnOnce(`Failed to convert image to png: ${name} ${e}`);
    return;
  }
  return {
    type: "png",
    width: width * PX_TO_PT,
    height: height * PX_TO_PT,
    data: png,
  };
};

const loadImages = async (
  root: mdast.Root,
  definition: GetDefinition,
  images: Map<string, PdfImageData | null>,
  cache: ImageCache,
  file: VFile,
  { load = loadWithFetch, toPng }: ImageOptions,
): Promise<void> => {
  const urls = new Set<string>();
  visit(root, (node) => {
    if (node.type === "image") {
      urls.add(node.url);
    } else if (node.type === "imageReference") {
      const def = definition(node.identifier);
      if (def) {
        urls.add(def.url);
      }
    }
  });

  await Promise.all(
    Array.from(urls, async (url) => {
      if (images.has(url)) {
        return;
      }
      // Relative urls may point to different images from other files
      const key = `${file.dirname}\0${url}`;
      const image = cache.get(key) ?? (await loadImage(url, file, load, toPng));
      if (!image) {
        return;
      }
      cache.set(key, image);
      // Plugins may have set this url while loading.
      if (!images.has(url)) {
        images.set(url, image);
      }
    }),
  );

  for (const key of cache.keys()) {
    if (cache.size <= MAX_CACHE_SIZE) {
      break;
    }
    cache.delete(key);
  }
};

export interface PdfOptions {
  /**
   * Standard fonts or privided custom fonts.
   * @default "Helvetica"
   */
  fonts?: (StandardFontType | CustomFont)[];
  /**
   * Page size.
   * https://pdfkit.org/docs/paper_sizes.html
   * @default A4
   */
  size?:
    | "A0"
    | "A1"
    | "A2"
    | "A3"
    | "A4"
    | "A5"
    | "A6"
    | "A7"
    | "A8"
    | "A9"
    | "A10"
    | "B0"
    | "B1"
    | "B2"
    | "B3"
    | "B4"
    | "B5"
    | "B6"
    | "B7"
    | "B8"
    | "B9"
    | "B10"
    | "C0"
    | "C1"
    | "C2"
    | "C3"
    | "C4"
    | "C5"
    | "C6"
    | "C7"
    | "C8"
    | "C9"
    | "C10";
  /**
   * Page margin.
   * @default 40
   */
  margin?:
    number | { top?: number; left?: number; bottom?: number; right?: number };
  /**
   * Page orientation.
   * @default "portrait"
   */
  orientation?: "portrait" | "landscape";
  /**
   * Spacing after Paragraphs.
   * @default undefined
   */
  spacing?: number;
  /**
   * How thematic break (`---`) is rendered.
   * - `"line"`: a horizontal line.
   * - `"pagebreak"`: a page break.
   * @default "pagebreak"
   */
  thematicBreak?: ThematicBreakStyle;
  /**
   * Styles that override the defaults.
   */
  styles?: Partial<StyleOption> & { default?: Partial<TextStyle> };
  /**
   * An option to find text and apply style (e.g. font to emoji)
   */
  textStyle?: TextStyleMatcher[];
  /**
   * Embed images of `image` / `imageReference` nodes. `png`, `jpg` and `svg` are supported.
   * Images are not embedded if not set.
   */
  image?: boolean | ImageOptions;
  /**
   * Plugins to customize how mdast nodes are compiled.
   */
  plugins?: RemarkPdfPlugin[];
  // preventOrphans?: boolean;
}

export async function mdastToPdf(
  node: mdast.Root,
  {
    fonts = ["Helvetica"],
    size: pageSize = "A4",
    margin,
    orientation,
    spacing,
    thematicBreak = "pagebreak",
    styles: { default: defaultStyle, ...style } = {},
    image,
    plugins = [],
    textStyle: textStyle = [],
    // preventOrphans,
  }: PdfOptions = {},
  imageCache: ImageCache,
  file: VFile,
): Promise<Uint8Array> {
  const definition = definitions(node);
  const destinations = collectDestinations(node, definition);

  const images = new Map<string, PdfImageData | null>();
  const [pluginBuilders] = await Promise.all([
    Promise.all(
      plugins.map((p) =>
        p({
          root: node,
          images,
          readImage: (data, name) =>
            readImage(
              toArrayBuffer(data),
              typeof image === "object" ? image.toPng : undefined,
              name,
            ),
        }),
      ),
    ),
    // Images set by plugins take precedence.
    image &&
      loadImages(
        node,
        definition,
        images,
        imageCache,
        file,
        image === true ? {} : image,
      ),
  ]);

  const defaultFont = fonts[0]!;
  const defaultFontName =
    typeof defaultFont === "string" ? defaultFont : defaultFont.name;

  const defaultBuilders: NodeBuilders = {
    paragraph: buildParagraph,
    heading: buildHeading,
    thematicBreak: buildThematicBreak,
    blockquote: buildBlockquote,
    list: buildList,
    listItem: noop,
    table: buildTable,
    tableRow: noop,
    tableCell: noop,
    html: fallbackText,
    code: buildCode,
    definition: noop,
    // footnoteDefinition: buildFootnoteDefinition,
    text: buildText,
    emphasis: buildEmphasis,
    strong: buildStrong,
    delete: buildDelete,
    inlineCode: buildInlineCode,
    break: buildBreak,
    link: buildLink,
    linkReference: buildLinkReference,
    image: buildImage,
    imageReference: buildImageReference,
    // footnoteReference: buildFootnoteReference,
    math: fallbackText,
    inlineMath: fallbackText,
  };
  const layers: NodeBuilders[] = [...pluginBuilders, defaultBuilders];

  const mergedDefaultStyle: TextStyle = {
    font: defaultFontName,
    fontSize: 12,
    color: "black",
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    ...defaultStyle,
  };

  const context: Context = {
    render(nodes, c) {
      const results: PdfLayout[] = [];
      for (const node of nodes) {
        let supported = false;
        for (const layer of layers) {
          const builder = layer[node.type] as
            NodeBuilder<mdast.RootContent["type"]> | undefined;
          if (builder) {
            supported = true;
            const r = builder(node, c ?? this);
            if (r) {
              if (Array.isArray(r)) {
                results.push(...r);
              } else {
                results.push(r);
              }
              break;
            }
          }
        }
        if (!supported) {
          warnOnce(`${node.type} node is not supported without plugins.`);
        }
      }
      return results;
    },
    style: mergedDefaultStyle,
    textStyle,
    config: deepmerge<StyleOption>(
      {
        head1: { fontSize: 24 },
        head2: { fontSize: 22 },
        head3: { fontSize: 20 },
        head4: { fontSize: 18 },
        head5: { fontSize: 16 },
        head6: { fontSize: 14 },
        link: { color: "#0000FF", underline: true },
        inlineCode: { color: "#333" },
        code: { color: "#333" },
      },
      style,
    ),
    thematicBreak,
    definition,
    destinations,
    images,
  };

  const nodes = context.render(node.children);

  const doc = new PDFDocument({
    size: pageSize,
    margins: {
      top: typeof margin === "number" ? margin : (margin?.top ?? 40),
      left: typeof margin === "number" ? margin : (margin?.left ?? 40),
      bottom: typeof margin === "number" ? margin : (margin?.bottom ?? 40),
      right: typeof margin === "number" ? margin : (margin?.right ?? 40),
    },
    layout: orientation,
    compress: true,
    // https://github.com/foliojs/pdfkit/issues/369#issuecomment-2545904551
    tagged: true,
    pdfVersion: "1.7",
    subset: "PDF/A-3a",
  });

  const fontMap = new Map<string, RegisteredFont>();
  for (const font of fonts) {
    if (typeof font !== "string") {
      const fontName = font.name;
      const defaultFont: RegisteredFont = {
        normal: fontName,
      };
      doc.registerFont(defaultFont.normal, font.normal);
      if (font.bold) {
        defaultFont.bold = `${fontName}-Bold`;
        doc.registerFont(defaultFont.bold, font.bold);
      }
      if (font.italic) {
        defaultFont.italic = `${fontName}-Italic`;
        doc.registerFont(defaultFont.italic, font.italic);
      }
      if (font.bolditalic) {
        defaultFont.bolditalic = `${fontName}-BoldItalic`;
        doc.registerFont(defaultFont.bolditalic, font.bolditalic);
      }
      fontMap.set(fontName, defaultFont);
    } else {
      fontMap.set(
        font,
        font === "Courier"
          ? {
              normal: "Courier",
              bold: "Courier-Bold",
              italic: "Courier-Oblique",
              bolditalic: "Courier-BoldOblique",
            }
          : font === "Times"
            ? {
                normal: "Times-Roman",
                bold: "Times-Bold",
                italic: "Times-Italic",
                bolditalic: "Times-BoldItalic",
              }
            : font === "Symbol"
              ? { normal: "Symbol" }
              : font === "ZapfDingbats"
                ? { normal: "ZapfDingbats" }
                : {
                    normal: "Helvetica",
                    bold: "Helvetica-Bold",
                    italic: "Helvetica-Oblique",
                    bolditalic: "Helvetica-BoldOblique",
                  },
      );
    }
  }
  const output = toBytes(doc);

  if ([...destinations.values()].includes(TOP)) {
    doc.addNamedDestination(TOP, "XYZ", null, 0, null);
  }

  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentHeight =
    doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const contentTop = doc.page.margins.top;
  const contentLeft = doc.page.margins.left;

  const box = layoutBlock(
    { type: "block", style: { display: "block" }, children: nodes },
    contentLeft,
    contentTop,
    {
      top: contentTop,
      width: contentWidth,
      spacing,
      textHeight: (font, fontSize) => {
        if (font != null && fontSize != null) {
          doc.font(font).fontSize(fontSize);
        }
        return doc.currentLineHeight();
      },
      textWidth: (text) => doc.widthOfString(text),
      resolveFont: (fontName, bold, italic) => {
        let targetFont = fontMap.get(fontName);
        if (!targetFont) {
          targetFont = fontMap.get(defaultFontName)!;
        }

        let font: string = targetFont.normal;
        if (bold && italic && targetFont.bolditalic) {
          font = targetFont.bolditalic;
        } else if (bold && targetFont.bold) {
          font = targetFont.bold;
        } else if (italic && targetFont.italic) {
          font = targetFont.italic;
        }
        return font;
      },
      resolveImageSize: (src) => {
        const data = images.get(src);
        if (data) {
          return { width: data.width, height: data.height };
        } else {
          return null;
        }
      },
    },
  );

  paintBoxes(box, doc, contentHeight, contentTop, images);

  doc.end();
  return output;
}

type AnchorHeading = (heading: HeadingAnchor, x: number, y: number) => void;

const anchorHeading = (doc: PDFKit.PDFDocument): AnchorHeading => {
  const parents: { depth: number; item: PDFKit.PDFOutline }[] = [];
  return ({ destination, depth, title }, x, y) => {
    doc.addNamedDestination(destination, "XYZ", x, y, null);

    while (parents.length && parents[parents.length - 1]!.depth >= depth) {
      parents.pop();
    }
    const parent = parents[parents.length - 1]?.item ?? doc.outline;
    const item = parent.addItem(title, {
      expanded: true,
      fit: false,
      top: y,
      // pdfkit takes left from the right edge of the page
      left: doc.page.width - x,
    });
    parents.push({ depth, item });
  };
};

const titleOf = (node: mdast.Heading): string => {
  const text = (n: mdast.Nodes): string =>
    "value" in n
      ? n.value
      : n.type === "image"
        ? (n.alt ?? "")
        : n.type === "break"
          ? " "
          : "children" in n
            ? n.children.map(text).join("")
            : "";
  return text(node).replace(/\s+/g, " ").trim();
};

const flattenBoxes = (box: LayoutBox): LayoutBox[] => {
  if (box.type === "block") {
    if (!box.border) {
      return box.children.flatMap(flattenBoxes);
    }
  }
  return [box];
};

const paintBoxes = (
  root: BlockBox,
  doc: PDFKit.PDFDocument,
  contentHeight: number,
  contentTop: number,
  images: ReadonlyMap<string, PdfImageData | null>,
): void => {
  const anchor = anchorHeading(doc);
  const boxes = flattenBoxes(root);
  let i = 0;
  while (i < boxes.length) {
    let pageBoxes: LayoutBox[] = [];
    let j = i;
    let pageBreak = false;
    let firstBoxY: number | null = null;
    while (j < boxes.length) {
      const box = boxes[j]!;
      if (box.type === "pagebreak") {
        pageBreak = true;
        break;
      }
      if (firstBoxY === null) {
        firstBoxY = box.y;
      }
      if (
        pageBoxes.length > 0 &&
        firstBoxY !== null &&
        box.y + box.height - firstBoxY > contentHeight
      ) {
        break;
      }
      pageBoxes.push(box);
      j++;
    }

    const hasContent =
      pageBoxes.length > 0 &&
      pageBoxes.some((b) => "height" in b && b.height > 0);
    if (hasContent) {
      const pageY0 = (firstBoxY ?? contentTop) - contentTop;
      for (const box of pageBoxes) {
        if (box.type === "block") {
          paintBlockBox(box, doc, pageY0, images, anchor);
        } else if (box.type === "text") {
          paintTextBox(box, doc, pageY0, anchor);
        } else if (box.type === "image") {
          paintImageBox(box, doc, pageY0, images, anchor);
        } else if (box.type === "hr") {
          paintRuleBox(box, doc, pageY0);
        }
      }
    }

    i = j;
    if (pageBreak) {
      doc.addPage();
      i++;
    } else if (hasContent && j < boxes.length) {
      doc.addPage();
    }
  }
};

const paintBlockBox = (
  box: BlockBox,
  doc: PDFKit.PDFDocument,
  offsetY: number,
  images: ReadonlyMap<string, PdfImageData | null>,
  anchor: AnchorHeading,
) => {
  for (const child of box.children) {
    if (child.type === "block") {
      paintBlockBox(child, doc, offsetY, images, anchor);
    } else if (child.type === "text") {
      paintTextBox(child, doc, offsetY, anchor);
    } else if (child.type === "image") {
      paintImageBox(child, doc, offsetY, images, anchor);
    } else if (child.type === "hr") {
      paintRuleBox(child, doc, offsetY);
    }
  }
  if (box.border) {
    doc.rect(box.x, box.y - offsetY, box.width, box.height).stroke();
  }
};

const paintTextBox = (
  box: TextBox,
  doc: PDFKit.PDFDocument,
  offsetY: number,
  anchor: AnchorHeading,
) => {
  const style = box.node.style;
  doc.font(box.font).fontSize(style.fontSize).fillColor(style.color);
  const { link, goTo, heading } = box.node.attrs;
  doc.text(box.text, box.x, box.y - offsetY, {
    strike: style.strike,
    underline: style.underline,
    link: link ?? null,
    goTo,
    continued: false,
  });
  // A text node may be split into several boxes
  if (heading && box.first) {
    anchor(heading, box.x, box.y - offsetY);
  }
};

const paintRuleBox = (
  box: RuleBox,
  doc: PDFKit.PDFDocument,
  offsetY: number,
) => {
  const { color, thickness } = box.node.style;
  const y = box.y - offsetY + thickness / 2;
  doc.save();
  doc
    .lineWidth(thickness)
    .strokeColor(color)
    .moveTo(box.x, y)
    .lineTo(box.x + box.width, y)
    .stroke();
  doc.restore();
};

const paintImageBox = (
  box: ImageBox,
  doc: PDFKit.PDFDocument,
  offsetY: number,
  images: ReadonlyMap<string, PdfImageData | null>,
  anchor: AnchorHeading,
) => {
  const data = images.get(box.node.attrs.src);
  if (data) {
    if (data.type === "svg") {
      // svg-to-pdfkit takes the width and height attributes of the svg,
      // in px, unless given preserveAspectRatio, which replaces the svg's
      // own, so that is passed on
      const root = /<svg\b[^>]*>/.exec(data.data)?.[0] ?? "";
      SVGtoPDF(doc, data.data, box.x, box.y - offsetY, {
        width: box.width,
        height: box.height,
        preserveAspectRatio:
          /\spreserveAspectRatio\s*=\s*["']([^"']*)["']/.exec(root)?.[1] ||
          "xMidYMid meet",
      });
    } else {
      doc.image(data.data, box.x, box.y - offsetY, {
        width: box.width,
        height: box.height,
      });
    }
    const heading = box.node.attrs.heading;
    if (heading) {
      anchor(heading, box.x, box.y - offsetY);
    }
  }
};

const buildParagraph: NodeBuilder<"paragraph"> = ({ children }, ctx) => {
  const style: BlockStyle = { display: "block" };
  const list = ctx.list;
  if (list) {
    const { meta, level } = list;
    const bulletText =
      meta.type === "task"
        ? meta.checked
          ? "[x] "
          : "[ ] "
        : meta.type === "ordered"
          ? Decimal.renderMarker(meta.number)
          : Disc.renderMarker(1);
    style.indent = level * 10;
    children = [{ type: "text", value: bulletText }, ...children];
  }
  return {
    type: "block",
    style,
    children: ctx.render(children),
  };
};

const buildHeading: NodeBuilder<"heading"> = (node, ctx) => {
  const { children, depth } = node;
  const results = ctx.render([{ type: "paragraph", children }], {
    ...ctx,
    style: { ...ctx.style, ...ctx.config[`head${depth}`] },
  });
  const destination = ctx.destinations.get(node);
  if (destination != null) {
    // Put the destination where the heading starts
    const first = results
      .flatMap((r) => (r.type === "block" ? r.children : [r]))
      .find((r) => r.type === "text" || r.type === "void");
    if (first) {
      first.attrs.heading = { destination, depth, title: titleOf(node) };
    }
  }
  return results;
};

const buildThematicBreak: NodeBuilder<"thematicBreak"> = ({}, ctx) => {
  if (ctx.thematicBreak === "pagebreak") {
    return {
      type: "pagebreak",
    };
  }
  const { color, fontSize } = ctx.style;
  return {
    type: "hr",
    style: {
      color,
      thickness: 1,
      margin: fontSize / 2,
    },
  };
};

const buildBlockquote: NodeBuilder<"blockquote"> = ({ children }, ctx) => {
  return ctx.render(children, {
    ...ctx,
    style: { ...ctx.style, ...ctx.config.blockquote },
  });
};

const buildList: NodeBuilder<"list"> = ({ children, ordered }, ctx) => {
  const parentList = ctx.list;
  const nextLevel = !parentList ? 0 : parentList.level + 1;

  return children.flatMap(({ children, checked }, i) => {
    let meta: ListContext["meta"];
    if (checked != null) {
      meta = {
        type: "task",
        checked,
      };
    } else {
      if (ordered) {
        meta = { type: "ordered", number: i + 1 };
      } else {
        meta = { type: "bullet" };
      }
    }

    return ctx.render(children, {
      ...ctx,
      list: {
        level: nextLevel,
        meta,
      },
    });
  });
};

const buildTable: NodeBuilder<"table"> = ({ children, align }, ctx) => {
  const cellAligns: Alignment[] | undefined = align?.map((a) => a ?? "left");
  return {
    type: "block",
    style: { display: "table" },
    children: children.map((row) => ({
      type: "block",
      style: { display: "table-row" },
      children: row.children.map((cell, colIdx) => ({
        type: "block",
        style: {
          display: "table-cell",
          textAlign: cellAligns?.[colIdx],
        },
        children: ctx.render(cell.children),
      })),
    })),
  };
};

const buildText: NodeBuilder<"text"> = ({ value: text }, ctx) => {
  const segments: TextNode[] = [];

  const matches: Match[] = [];
  type Match = { start: number; end: number; style: Partial<TextStyle> };
  for (const [re, style] of ctx.textStyle) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        style,
      });
    }
  }
  matches.sort((a, b) => a.start - b.start);

  const createText = (
    style: TextStyle,
    start: number,
    end?: number,
  ): TextNode => {
    return {
      type: "text",
      text: text.slice(start, end),
      style: style,
      attrs: { link: ctx.link, goTo: ctx.goTo },
    };
  };

  let i = 0;
  for (const { start, end, style } of matches) {
    if (i < start) {
      segments.push(createText(ctx.style, i, start));
    }
    segments.push(createText({ ...ctx.style, ...style }, start, end));
    i = end;
  }
  if (i < text.length) {
    segments.push(createText(ctx.style, i));
  }
  return segments;
};

const buildEmphasis: NodeBuilder<"emphasis"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, italic: true },
  });
};

const buildStrong: NodeBuilder<"strong"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, bold: true },
  });
};

const buildDelete: NodeBuilder<"delete"> = (node, ctx) => {
  return ctx.render(node.children, {
    ...ctx,
    style: { ...ctx.style, strike: true },
  });
};

const buildInlineCode: NodeBuilder<"inlineCode"> = (node, ctx) => {
  return ctx.render([{ type: "text", value: node.value }], {
    ...ctx,
    style: { ...ctx.style, ...ctx.config.inlineCode },
  });
};

const buildCode: NodeBuilder<"code"> = (node, ctx) => {
  return {
    type: "block",
    style: { display: "block" },
    children: ctx.render([{ type: "text", value: node.value }], {
      ...ctx,
      style: { ...ctx.style, ...ctx.config.code },
    }),
  };
};

const buildBreak: NodeBuilder<"break"> = ({}, ctx) => {
  return buildText({ type: "text", value: "\n" }, ctx);
};

const buildLink: NodeBuilder<"link"> = ({ children, url }, ctx) => {
  let link: string | undefined;
  let goTo: string | undefined;
  if (url.startsWith("#")) {
    goTo = ctx.destinations.get(url);
    if (goTo == null) {
      // Leave links to missing headings unlinked
      return ctx.render(children);
    }
  } else {
    link = url;
  }
  return ctx.render(children, {
    ...ctx,
    link,
    goTo,
    style: {
      ...ctx.style,
      ...ctx.config.link,
    },
  });
};

const buildLinkReference: NodeBuilder<"linkReference"> = (
  { children, identifier },
  ctx,
) => {
  const def = ctx.definition(identifier);
  if (def == null) {
    return ctx.render(children);
  }
  return buildLink({ type: "link", children, url: def.url }, ctx);
};

const buildImage: NodeBuilder<"image"> = (node, ctx) => {
  if (!ctx.images.get(node.url)) {
    // Keep the description of the image if it can't be embedded
    return node.alt ? buildText({ type: "text", value: node.alt }, ctx) : null;
  }
  return { type: "void", tag: "image", attrs: { src: node.url } };
};

const buildImageReference: NodeBuilder<"imageReference"> = (node, ctx) => {
  const def = ctx.definition(node.identifier);
  if (def == null) {
    return null;
  }
  return buildImage(
    { type: "image", url: def.url, alt: node.alt, title: def.title },
    ctx,
  );
};

// The destination of the top of the document. Slugs never contain `#`.
const TOP = "#top";

const collectDestinations = (
  root: mdast.Root,
  definition: GetDefinition,
): Map<mdast.Heading | string, string> => {
  const slugger = new GithubSlugger();
  // Slugs are unique, so headings can be keyed by them
  const headings = new Map<string, mdast.Heading>();
  const fragments = new Map<string, string>();
  visit(root, (n) => {
    switch (n.type) {
      case "heading": {
        // Like GitHub, slug the rendered text
        const text = toString(n, {
          includeHtml: false,
          includeImageAlt: false,
        });
        headings.set(slugger.slug(text), n);
        break;
      }
      case "link":
      case "linkReference": {
        const url = n.type === "link" ? n.url : definition(n.identifier)?.url;
        if (url?.startsWith("#")) {
          try {
            fragments.set(url, decodeURIComponent(url.slice(1)));
          } catch {
            // Leave malformed fragments unlinked
          }
        }
        break;
      }
    }
  });

  // PDF has no restriction on names, so every heading is a destination named
  // by its slug, which also lets other documents link to `file.pdf#slug`.
  const destinations = new Map<mdast.Heading | string, string>();
  for (const [slug, heading] of headings) {
    destinations.set(heading, slug);
  }
  for (const [url, fragment] of fragments) {
    // Like HTML, `#` and `#top` go to the top unless a heading has that slug.
    const destination = headings.has(fragment)
      ? fragment
      : /^(top)?$/i.test(fragment)
        ? TOP
        : undefined;
    if (destination != null) {
      destinations.set(url, destination);
    }
  }
  return destinations;
};

const noop = () => {
  return null;
};

const fallbackText = (node: { type: string; value: string }, ctx: Context) => {
  warnOnce(
    `${node.type} node is not supported without plugins, falling back to text.`,
  );
  return buildText({ type: "text", value: node.value }, ctx);
};
