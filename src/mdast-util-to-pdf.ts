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
import type * as hast from "hast";
import {
  defaultHandlers,
  toHast,
  type Handler,
  type State,
} from "mdast-util-to-hast";
import {
  Document,
  Element,
  HTMLContentModel,
  Text,
  TRenderEngine,
  type StylesConfig,
} from "@native-html/transient-render-engine";
import { imageSize } from "image-size";
import { definitions } from "mdast-util-definitions";
import { SKIP, visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import type { InlineMath, Math } from "mdast-util-math";
import GithubSlugger from "github-slugger";
import { toArrayBuffer, warnOnce, type ToPngFn } from "./utils";
import {
  layoutBlock,
  paginate,
  type Box,
  type Page,
  type Style,
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

type KnownNodeType = mdast.RootContent["type"];

type MdastNode<T extends KnownNodeType> = Extract<
  mdast.RootContent,
  { type: T }
>;

export type Context = Readonly<{
  render: (nodes: readonly mdast.RootContent[]) => hast.ElementContent[];
}>;

export type NodeBuilder<T extends KnownNodeType> = (
  node: MdastNode<T>,
  ctx: Context,
) => hast.ElementContent | hast.ElementContent[] | null;

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
  urls: ReadonlySet<string>,
  images: Map<string, PdfImageData | null>,
  cache: ImageCache,
  file: VFile,
  { load = loadWithFetch, toPng }: ImageOptions,
): Promise<void> => {
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
   * Title of the document.
   */
  title?: string;
  /**
   * Standard fonts or provided custom fonts.
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
}

export async function mdastToPdf(
  root: mdast.Root,
  {
    title,
    fonts = ["Helvetica"],
    size: pageSize = "A4",
    margin,
    orientation,
    spacing,
    thematicBreak = "pagebreak",
    styles: { default: defaultStyle, ...style } = {},
    image,
    plugins = [],
    textStyle = [],
  }: PdfOptions = {},
  imageCache: ImageCache,
  file: VFile,
): Promise<Uint8Array> {
  // the images to load, and the slugs of the headings in document order
  const definition = definitions(root);
  const urls = new Set<string>();
  const slugger = new GithubSlugger();
  const slugs = new Map<mdast.Heading, string>();
  visit(root, (node) => {
    switch (node.type) {
      case "heading":
        // Like GitHub, slug the rendered text
        slugs.set(
          node,
          slugger.slug(
            toString(node, { includeHtml: false, includeImageAlt: false }),
          ),
        );
        break;
      case "image":
        urls.add(node.url);
        break;
      case "imageReference":
        urls.add(definition(node.identifier)!.url);
        break;
    }
  });

  const imageOptions = image === true ? {} : image || undefined;
  const images = new Map<string, PdfImageData | null>();
  const [pluginBuilders] = await Promise.all([
    Promise.all(
      plugins.map((p) =>
        p({
          root,
          images,
          readImage: (data, name) =>
            readImage(toArrayBuffer(data), imageOptions?.toPng, name),
        }),
      ),
    ),
    // Images set by plugins take precedence.
    imageOptions && loadImages(urls, images, imageCache, file, imageOptions),
  ]);
  const hastRoot = toHast(root, {
    handlers: composeHandlers(pluginBuilders, {
      heading: (state, node: mdast.Heading) => {
        const element = defaultHandlers.heading(state, node);
        const slug = slugs.get(node);
        if (slug) {
          element.properties["id"] = slug;
        }
        element.properties["dataTitle"] = titleOf(node);
        return element;
      },
      // images are keyed by their urls as written, which mdast-util-to-hast
      // percent-encodes
      image: (state, node: mdast.Image) => {
        if (!images.get(node.url)) {
          return altText(state, node);
        }
        const element = defaultHandlers.image(state, node);
        element.properties["src"] = node.url;
        return element;
      },
      imageReference: (state, node: mdast.ImageReference) => {
        const { url } = definition(node.identifier)!;
        if (!images.get(url)) {
          return altText(state, node);
        }
        const element = defaultHandlers.imageReference(
          state,
          node,
        ) as hast.Element;
        element.properties["src"] = url;
        return element;
      },
      // code outside a code block, which TRE's selectors can't tell apart
      inlineCode: (state, node: mdast.InlineCode) => {
        const element = defaultHandlers.inlineCode(state, node);
        element.properties["className"] = ["inline"];
        return element;
      },
      html: (_, node: mdast.Html, parent) => {
        switch (parent?.type) {
          case "root":
          case "blockquote":
          case "listItem":
          case "footnoteDefinition":
            return toRawBlock(fallBackToText(node));
          default:
            return fallBackToText(node);
        }
      },
      math: (_, node: Math) => toRawBlock(fallBackToText(node)),
      inlineMath: (_, node: InlineMath) => fallBackToText(node),
      yaml: dropUnsupported,
      toml: dropUnsupported,
    }),
  }) as hast.Root;

  const linksToTop = resolveLinks(hastRoot);

  const doc = new PDFDocument({
    size: pageSize,
    margins: {
      top: typeof margin === "number" ? margin : (margin?.top ?? 40),
      left: typeof margin === "number" ? margin : (margin?.left ?? 40),
      bottom: typeof margin === "number" ? margin : (margin?.bottom ?? 40),
      right: typeof margin === "number" ? margin : (margin?.right ?? 40),
    },
    layout: orientation,
    info: title != null ? { Title: title } : undefined,
    displayTitle: title != null,
    compress: true,
    // https://github.com/foliojs/pdfkit/issues/369#issuecomment-2545904551
    tagged: true,
    pdfVersion: "1.7",
    subset: "PDF/A-3a",
  });

  const defaultFont = fonts[0]!;
  const defaultFontName =
    typeof defaultFont === "string" ? defaultFont : defaultFont.name;

  const fontMap = new Map<string, RegisteredFont>();
  for (const font of fonts) {
    if (typeof font !== "string") {
      const fontName = font.name;
      const family: RegisteredFont = {
        normal: fontName,
      };
      doc.registerFont(family.normal, font.normal);
      if (font.bold) {
        family.bold = `${fontName}-Bold`;
        doc.registerFont(family.bold, font.bold);
      }
      if (font.italic) {
        family.italic = `${fontName}-Italic`;
        doc.registerFont(family.italic, font.italic);
      }
      if (font.bolditalic) {
        family.bolditalic = `${fontName}-BoldItalic`;
        doc.registerFont(family.bolditalic, font.bolditalic);
      }
      fontMap.set(fontName, family);
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
  const baseStyle = { fontSize: 12, color: "black", ...defaultStyle };
  const toStyle = (option: Readonly<Partial<TextStyle>>): Style => {
    const css: Style = {};
    // a font not registered is inherited from the parent
    if (option.font != null && fontMap.has(option.font))
      css.fontFamily = option.font;
    if (option.fontSize != null) css.fontSize = option.fontSize;
    if (option.color != null) css.color = option.color;
    if (option.bold != null) css.fontWeight = option.bold ? "bold" : "normal";
    if (option.italic != null)
      css.fontStyle = option.italic ? "italic" : "normal";
    if (option.underline != null || option.strike != null) {
      css.textDecorationLine =
        option.underline && option.strike
          ? "underline line-through"
          : option.underline
            ? "underline"
            : option.strike
              ? "line-through"
              : "none";
    }
    return css;
  };

  const cellStyle: Style = {
    flexGrow: 1,
    flexBasis: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    paddingTop: 2,
    paddingRight: 2,
    paddingBottom: 2,
    paddingLeft: 2,
  };
  const blockSpacing: Style = spacing ? { marginBottom: spacing } : {};
  const tree = new TRenderEngine({
    // TRE's types of styles come from a package that package.json overrides
    // with an empty one: the styles are typed as remark-pdf's own
    stylesConfig: {
      enableUserAgentStyles: false,
      // the first font, unless the default style has one registered
      baseStyle: { fontFamily: defaultFontName, ...toStyle(baseStyle) },
      tagsStyles: {
        p: blockSpacing,
        em: { fontStyle: "italic" },
        strong: { fontWeight: "bold" },
        del: { textDecorationLine: "line-through" },
        h1: { ...toStyle({ fontSize: 24, ...style.head1 }), ...blockSpacing },
        h2: { ...toStyle({ fontSize: 22, ...style.head2 }), ...blockSpacing },
        h3: { ...toStyle({ fontSize: 20, ...style.head3 }), ...blockSpacing },
        h4: { ...toStyle({ fontSize: 18, ...style.head4 }), ...blockSpacing },
        h5: { ...toStyle({ fontSize: 16, ...style.head5 }), ...blockSpacing },
        h6: { ...toStyle({ fontSize: 14, ...style.head6 }), ...blockSpacing },
        a: toStyle({ color: "#0000FF", underline: true, ...style.link }),
        pre: {
          ...toStyle({ color: "#333", ...style.code }),
          whiteSpace: "pre",
          ...blockSpacing,
        },
        blockquote: toStyle(style.blockquote ?? {}),
        // the top edge is the header cells', which goes with the header row
        // to its page: a table continued on a page has none there
        table: { borderLeftWidth: 1, ...blockSpacing },
        tr: { flexDirection: "row" },
        td: cellStyle,
        th: { ...cellStyle, borderTopWidth: 1 },
        hr: {
          borderTopWidth: 1,
          borderTopColor: "currentcolor",
          marginTop: baseStyle.fontSize / 2,
          marginBottom: baseStyle.fontSize / 2,
        },
        // a padding the layout widens to fit the markers
        ul: {
          listStyleType: "disc",
          paddingLeft: baseStyle.fontSize * 2,
          ...blockSpacing,
        },
        ol: {
          listStyleType: "decimal",
          paddingLeft: baseStyle.fontSize * 2,
          ...blockSpacing,
        },
      } satisfies Record<string, Style>,
      classesStyles: {
        raw: { whiteSpace: "pre", ...blockSpacing },
        center: { textAlign: "center" },
        math: { textAlign: "center", ...blockSpacing },
        inline: toStyle({ color: "#333", ...style.inlineCode }),
        left: { textAlign: "left" },
        right: { textAlign: "right" },
        // a task's checkbox is its marker
        "task-list-item": { listStyleType: "none" },
        // toDom's class, for what TRE's selectors can't tell apart
        "last-in-item": { marginBottom: 0 },
        ...Object.fromEntries(
          textStyle.map(([, s], i): [string, Style] => [`t${i}`, toStyle(s)]),
        ),
      } satisfies Record<string, Style>,
    } as unknown as StylesConfig,
    // TRE would split font names on commas and take quotes out of them
    cssProcessorConfig: { skipFontFamilyValidation: true },
    removeLineBreaksAroundEastAsianDiscardSet: true,
    // images in inline flow instead of hoisted out of phrasing
    // https://github.com/meliorence/react-native-render-html/issues/593, as
    // text that isn't void: TRE drops the space after a void text, as after <br>
    customizeHTMLModels: (models) => ({
      ...models,
      img: models.img.extend({
        contentModel: HTMLContentModel.textual,
        isVoid: false,
      }),
    }),
  }).buildTTreeFromDoc(
    new Document(
      toDom(
        hastRoot.children,
        textStyle.map(
          ([p]) =>
            new RegExp(
              p.source,
              p.flags.includes("g") ? p.flags : p.flags + "g",
            ),
        ),
      ),
    ),
  );

  const { width, height, margins } = doc.page;
  const contentTop = margins.top;
  const contentHeight = height - margins.top - margins.bottom;

  const layout = layoutBlock(
    tree,
    margins.left,
    contentTop,
    width - margins.left - margins.right,
    {
      isPageBreak: (node) =>
        thematicBreak === "pagebreak" && node.tagName === "hr",
      // the closest face, synthesizing what it lacks
      font: ({ fontFamily, fontWeight, fontStyle }) => {
        // every node inherits a registered font from the base style
        const family = fontMap.get(fontFamily!)!;
        const bold = fontWeight === "bold";
        const italic = fontStyle === "italic";
        const face =
          (bold && italic && family.bolditalic) ||
          (bold && family.bold) ||
          (italic && family.italic) ||
          family.normal;
        return {
          name: face,
          bold: bold && face !== family.bold && face !== family.bolditalic,
          italic:
            italic && face !== family.italic && face !== family.bolditalic,
        };
      },
      lineHeight: (font, fontSize) =>
        doc.font(font.name).fontSize(fontSize).currentLineHeight(true),
      textHeight: (font, fontSize) =>
        doc.font(font.name).fontSize(fontSize).currentLineHeight(),
      textWidth: (text, font, fontSize) =>
        doc.font(font.name).fontSize(fontSize).widthOfString(text),
      imageSize: (src) => images.get(src)!,
      maxImageHeight: contentHeight,
    },
  );

  paintPages(
    doc,
    paginate(layout, contentHeight, contentTop),
    linksToTop,
    images,
  );

  // the bytes the document streams, which it keeps until they are read
  const bytes = toBytes(doc);
  doc.end();
  return bytes;
}

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

const dropUnsupported: Handler = (_, node) => {
  warnOnce(`${node.type} node is not supported without plugins.`);
  return undefined;
};

const fallBackToText = (node: mdast.Html | Math | InlineMath): hast.Text => {
  warnOnce(
    `${node.type} node is not supported without plugins, falling back to text.`,
  );
  return { type: "text", value: node.value };
};

const altText = (
  state: State,
  node: mdast.Image | mdast.ImageReference,
): hast.Text | undefined => {
  if (!node.alt) {
    return undefined;
  }
  const text: hast.Text = { type: "text", value: node.alt };
  // text of the markdown, which textStyle applies to
  state.patch(node, text);
  return text;
};

// fallback text that is a block: not a p, which a tight list item unwraps
const toRawBlock = (text: hast.Text): hast.Element => ({
  type: "element",
  tagName: "div",
  properties: { className: ["raw"] },
  children: [text],
});

const composeHandlers = (
  layers: readonly NodeBuilders[],
  handlers: Readonly<Record<string, Handler>>,
): Record<string, Handler> => {
  const composed = { ...handlers };
  for (const type of new Set(layers.flatMap((layer) => Object.keys(layer)))) {
    const builders = layers.flatMap(
      (layer) => layer[type as KnownNodeType] ?? [],
    ) as NodeBuilder<KnownNodeType>[];
    const base =
      handlers[type] ?? (defaultHandlers as Record<string, Handler>)[type];
    composed[type] = (state: State, node, parent) => {
      const ctx: Context = {
        render: (nodes) =>
          state.all({ type: "root", children: nodes as mdast.RootContent[] }),
      };
      for (const builder of builders) {
        const result = builder(node as MdastNode<KnownNodeType>, ctx);
        if (result != null) {
          return result;
        }
      }
      return base?.(state, node, parent);
    };
  }
  return composed;
};

// The destination of the top of the document. Slugs never contain `#`.
const TOP = "#top";

// Settles the ids and links of the printed tree: drops what footnotes don't
// print, keeps each id on its first element and unwraps links to no id.
// Returns whether a link goes to the top.
const resolveLinks = (root: hast.Root): boolean => {
  const ids = new Set<string>();
  const links: [link: hast.Element, href: string, parent: hast.Parents][] = [];
  visit(root, "element", (element, index, parent) => {
    const className = element.properties["className"];
    if (
      // printed footnotes need no links back, whose "↩" standard fonts lack
      element.properties["dataFootnoteBackref"] != null ||
      // the heading mdast-util-to-hast gives footnotes is for screen readers
      (Array.isArray(className) && className.includes("sr-only"))
    ) {
      parent!.children.splice(index!, 1);
      return [SKIP, index!];
    }
    // only the backrefs link to footnote references
    if (element.properties["dataFootnoteRef"] != null) {
      delete element.properties["id"];
    }
    // the first element of an id is the one it names
    const id = element.properties["id"];
    if (id != null) {
      const key = String(id);
      if (ids.has(key)) {
        delete element.properties["id"];
      } else {
        ids.add(key);
      }
    }
    const href = element.properties["href"];
    if (
      element.tagName === "a" &&
      typeof href === "string" &&
      href[0] === "#"
    ) {
      links.push([element, href, parent!]);
    }
    return;
  });
  let toTop = false;
  for (const [link, href, parent] of links) {
    const target = targetOf(href, ids);
    if (target == null) {
      parent.children.splice(
        parent.children.indexOf(link),
        1,
        ...link.children,
      );
    } else {
      toTop ||= target === TOP;
      link.properties["href"] = `#${target}`;
    }
  }
  return toTop;
};

// HTML's rule: the id as written, then decoded, then `#` and `#top` the top
const targetOf = (
  href: string,
  ids: ReadonlySet<string>,
): string | undefined => {
  let fragment: string | undefined;
  try {
    fragment = decodeURIComponent(href.slice(1));
  } catch {
    // a malformed escape
  }
  return (
    [href.slice(1), fragment].find((id) => id != null && ids.has(id)) ??
    (fragment != null && /^(top)?$/i.test(fragment) ? TOP : undefined)
  );
};

// `patterns`: those of textStyle, global for matchAll
const toDom = (
  children: readonly hast.RootContent[],
  patterns: readonly RegExp[],
  parent?: hast.Element,
): (Element | Text)[] => {
  const results: (Element | Text)[] = [];
  children.forEach((child) => {
    if (child.type === "text") {
      // the line breaks mdast-util-to-hast puts between elements aren't text
      // of the markdown, which textStyle applies to
      if (child.position || /\S/.test(child.value)) {
        results.push(...styleText(child.value, patterns));
      } else {
        results.push(new Text(child.value));
      }
      return;
    }
    if (child.type !== "element") {
      return;
    }

    const { tagName, properties } = child;
    // remark-pdf's classes, before mdast-util-to-hast's, which TRE applies
    // over them: a task list's over its bullets
    const classes: string[] = [];
    const attrs: Record<string, string> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (value != null && key !== "className") {
        attrs[key] = String(value);
      }
    }
    switch (tagName) {
      // the checkbox of a task list item, which TRE has no model for, as text
      // https://github.com/meliorence/react-native-render-html/issues/609
      case "input":
        results.push(
          ...styleText(properties["checked"] ? "[x]" : "[ ]", patterns),
        );
        return;
      case "td":
      case "th": {
        if (typeof properties["align"] === "string") {
          classes.push(properties["align"]);
        }
        break;
      }
      // a list nested last in an item
      case "ul":
      case "ol":
        if (
          parent?.tagName === "li" &&
          child === parent.children.findLast((c) => c.type === "element")
        ) {
          classes.push("last-in-item");
        }
        break;
    }
    if (Array.isArray(properties["className"])) {
      classes.push(...properties["className"].map(String));
    }
    if (classes.length) {
      attrs["class"] = classes.join(" ");
    }
    results.push(
      new Element(tagName, attrs, toDom(child.children, patterns, child)),
    );
  });
  return results;
};

const styleText = (
  text: string,
  patterns: readonly RegExp[],
): (Element | Text)[] => {
  const matches: {
    readonly start: number;
    readonly end: number;
    readonly index: number;
  }[] = [];
  const bounds = new Set([0, text.length]);
  patterns.forEach((re, index) => {
    for (const m of text.matchAll(re)) {
      if (m[0]) {
        const start = m.index;
        const end = start + m[0].length;
        matches.push({ start, end, index });
        bounds.add(start);
        bounds.add(end);
      }
    }
  });
  const cuts = Array.from(bounds).sort((a, b) => a - b);
  const results: (Element | Text)[] = [];
  for (let k = 1; k < cuts.length; k++) {
    const start = cuts[k - 1]!;
    const end = cuts[k]!;
    let node: Element | Text = new Text(text.slice(start, end));
    // in the order of the patterns, later ones inner, overriding earlier ones;
    // a pattern's matches don't overlap
    for (let j = matches.length - 1; j >= 0; j--) {
      const m = matches[j]!;
      if (m.start <= start && end <= m.end) {
        node = new Element("span", { class: `t${m.index}` }, [node]);
      }
    }
    results.push(node);
  }
  return results;
};

const paintPages = (
  doc: PDFKit.PDFDocument,
  pages: readonly Page[],
  linksToTop: boolean,
  images: ReadonlyMap<string, PdfImageData | null>,
): void => {
  let fill: string | undefined;
  const setFill = (color: string): void => {
    // set only on change, as pdfkit writes it out on every call
    if (color !== fill) {
      fill = color;
      doc.fillColor(...toPdfColor(color));
    }
  };

  // pdfkit embeds an image given as a string once, however often it's drawn:
  // a data URI of each
  const toDataUri = (data: ArrayBuffer): string => {
    const bytes = new Uint8Array(data);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return "data:image;base64," + btoa(binary);
  };
  const outline: {
    readonly level: number;
    readonly item: PDFKit.PDFOutline;
  }[] = [];

  const paintBox = (box: Box, offsetY: number): void => {
    const y = box.y - offsetY;
    switch (box.type) {
      case "text": {
        const { font, fontSize, color, decorations } = box.format;
        // not text of the document, so that copying joins a hyphenated word
        if (box.added) {
          doc.markContent("Artifact");
        }
        setFill(color);
        if (font.bold) {
          // synthesized bold, stroking glyph outlines
          doc.save();
          doc.strokeColor(...toPdfColor(color)).lineWidth(fontSize / 30);
        }
        doc.font(font.name).fontSize(fontSize);
        // no wrapping nor page breaking by pdfkit; decorations as pdfkit
        // places them, in the color of the text
        doc.text(box.text, box.x, y, {
          lineBreak: false,
          underline: decorations.includes("underline"),
          strike: decorations.includes("line-through"),
          stroke: font.bold,
          fill: true,
          oblique: font.italic,
        });
        if (font.bold) {
          doc.restore();
        }
        if (box.added) {
          doc.endMarkedContent();
        }
        break;
      }
      case "image": {
        const data = images.get(box.src)!;
        if (data.type === "svg") {
          // svg-to-pdfkit takes the width and height attributes of the svg,
          // in px, unless given preserveAspectRatio, which replaces the svg's
          // own, so that is passed on
          const svgTag = /<svg\b[^>]*>/.exec(data.data)?.[0] ?? "";
          SVGtoPDF(doc, data.data, box.x, y, {
            width: box.width,
            height: box.height,
            preserveAspectRatio:
              /\spreserveAspectRatio\s*=\s*["']([^"']*)["']/.exec(
                svgTag,
              )?.[1] || "xMidYMid meet",
          });
        } else {
          doc.image(toDataUri(data.data), box.x, y, {
            width: box.width,
            height: box.height,
          });
        }
        break;
      }
      case "anchor": {
        if (box.id != null) {
          doc.addNamedDestination(box.id, "XYZ", box.x, y, null);
        }
        if (box.outline) {
          const { level, title } = box.outline;
          // the nearest heading of a higher level is the parent
          while ((outline.at(-1)?.level ?? 0) >= level) {
            outline.pop();
          }
          const parent = outline.at(-1)?.item ?? doc.outline;
          const item = parent.addItem(title, {
            expanded: true,
            fit: false,
            top: y,
            // pdfkit takes left from the right edge of the page
            left: doc.page.width - box.x,
          });
          outline.push({ level, item });
        }
        break;
      }
      case "link": {
        const rect = [box.x, y, box.width, box.height] as const;
        if (box.link.startsWith("#")) {
          doc.goTo(...rect, box.link.slice(1));
        } else {
          doc.link(...rect, box.link);
        }
        break;
      }
      case "block":
      case "line":
        for (const child of box.children) {
          paintBox(child, offsetY);
        }
        break;
    }
  };

  // a side of a frame, a line inside its box
  const strokeSide = (
    width: number,
    color: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): void => {
    if (width > 0) {
      doc
        .lineWidth(width)
        .strokeColor(...toPdfColor(color))
        .moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke();
    }
  };

  if (linksToTop) {
    doc.addNamedDestination(TOP, "XYZ", null, 0, null);
  }
  pages.forEach(({ boxes, offsetY, frames, frameHeight }, i) => {
    if (i > 0) {
      doc.addPage();
      // a new page starts with the default graphics state
      fill = undefined;
    }
    if (frames.length) {
      doc.save();
      doc.rect(0, doc.page.margins.top, doc.page.width, frameHeight).clip();
      for (const { x, y: top, width, height, frame } of frames) {
        const y = top - offsetY;
        const {
          widths: [t, r, b, l],
          colors: [ct, cr, cb, cl],
        } = frame;
        strokeSide(t, ct, x, y + t / 2, x + width, y + t / 2);
        strokeSide(r, cr, x + width - r / 2, y, x + width - r / 2, y + height);
        strokeSide(b, cb, x, y + height - b / 2, x + width, y + height - b / 2);
        strokeSide(l, cl, x + l / 2, y, x + l / 2, y + height);
      }
      doc.restore();
    }
    for (const box of boxes) {
      paintBox(box, offsetY);
    }
  });
};

// pdfkit reads only hex colors without alpha and color names
const toPdfColor = (
  value: string,
): [color: PDFKit.Mixins.ColorValue, opacity: number] => {
  const color = value.trim().toLowerCase();
  if (color === "transparent") {
    return [[0, 0, 0], 0];
  }
  if (color === "rebeccapurple") {
    // the CSS color pdfkit's names lack
    return [[102, 51, 153], 1];
  }
  const hex = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/.exec(color)?.[1];
  if (hex) {
    const digits = hex.length <= 4 ? hex.replace(/./g, "$&$&") : hex;
    const [r, g, b, a = 255] = digits.match(/../g)!.map((h) => parseInt(h, 16));
    return [[r!, g!, b!], a / 255];
  }
  const fn = /^(rgb|hsl)a?\((.*)\)$/.exec(color);
  if (fn) {
    const args = fn[2]!.split(/[\s,/]+/).filter(Boolean);
    const parseValue = (v: string | undefined, max: number): number =>
      v == null
        ? max
        : v.endsWith("%")
          ? (parseFloat(v) / 100) * max
          : parseFloat(v);
    const alpha = Math.min(1, Math.max(0, parseValue(args[3], 1)));
    if (fn[1] === "rgb") {
      const [r, g, b] = args.map((v) => parseValue(v, 255));
      return [[r!, g!, b!], alpha];
    }
    // https://www.w3.org/TR/css-color-4/#hsl-to-rgb
    const hue = parseFloat(args[0] ?? "0");
    const saturation = parseValue(args[1], 1);
    const lightness = parseValue(args[2], 1);
    const channel = (n: number): number => {
      const k = (n + hue / 30) % 12;
      const a = saturation * Math.min(lightness, 1 - lightness);
      return (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
    };
    return [[channel(0), channel(8), channel(4)], alpha];
  }
  return [color, 1];
};
