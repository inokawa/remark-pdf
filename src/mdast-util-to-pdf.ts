import type * as mdast from "mdast";
import PDFDocument from "pdfkit";
// @ts-expect-error
import SVGtoPDF from "svg-to-pdfkit";
import Decimal from "@jsamr/counter-style/presets/decimal";
import Disc from "@jsamr/counter-style/presets/disc";
import { definitions, type GetDefinition } from "mdast-util-definitions";
import deepmerge from "deepmerge";
import { warnOnce } from "./utils";
import imageSize from "image-size";
import { visit } from "unist-util-visit";

type KnownNodeType = mdast.RootContent["type"];

type MdastNode<T extends string> = T extends KnownNodeType
  ? Extract<mdast.RootContent, { type: T }>
  : unknown;

type NodeBuilder<T extends string> = (
  node: MdastNode<T>,
  ctx: Context,
) => PdfLayout | PdfLayout[] | null;

type NodeBuilders = {
  [K in KnownNodeType]?: NodeBuilder<K>;
};

type StandardFontType =
  | "Courier"
  | "Helvetica"
  | "Symbol"
  | "Times"
  | "ZapfDingbats";

type FontBuffer = ArrayBuffer | Uint8Array;

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

type Alignment = "left" | "right" | "center";

export type TextStyleMatcher = [pattern: RegExp, style: Partial<TextStyle>];

interface PdfParagraph {
  type: "paragraph";
  list?: ListContext;
  children: PdfLayout[];
}

interface PdfTable {
  type: "table";
  align?: Alignment[];
  cells: { children: PdfLayout[] }[][];
}

interface PdfPageBreak {
  type: "pagebreak";
}

interface PdfText {
  type: "text";
  text: string;
  link?: string;
  style: TextStyle;
}

interface PdfImage {
  type: "image";
  data: PdfImageData;
}

type PdfLayout = PdfParagraph | PdfPageBreak | PdfTable | PdfText | PdfImage;

type ListContext = Readonly<{
  level: number;
  meta: Readonly<
    | {
        type: "bullet";
      }
    | {
        type: "ordered";
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
  link: Partial<TextStyle>;
  head1: Partial<TextStyle>;
  head2: Partial<TextStyle>;
  head3: Partial<TextStyle>;
  head4: Partial<TextStyle>;
  head5: Partial<TextStyle>;
  head6: Partial<TextStyle>;
}

export type PdfImageData = Readonly<
  {
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

type Context = Readonly<{
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
  images: ReadonlyMap<string, PdfImageData | null>;
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
  definition: GetDefinition;
}>;

type LoadImageFn = (url: string) => Promise<ArrayBuffer>;
const loadWithFetch: LoadImageFn = async (url) => {
  const res = await fetch(url);
  return res.arrayBuffer();
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
    | number
    | { top?: number; left?: number; bottom?: number; right?: number };
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
   * Styles that override the defaults.
   */
  styles?: Partial<StyleOption> & { default?: Partial<TextStyle> };
  /**
   * An option to find text and apply style (e.g. font to emoji)
   */
  textStyle?: TextStyleMatcher[];
  /**
   * A function to resolve image data from url.
   * @default {@link loadWithFetch}
   */
  loadImage?: LoadImageFn;
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
    styles: { default: defaultStyle, ...style } = {},
    loadImage = loadWithFetch,
    textStyle: textStyle = [],
    // preventOrphans,
  }: PdfOptions = {},
): Promise<ArrayBuffer> {
  const definition = definitions(node);

  const images = new Map<string, PdfImageData | null>();
  const imageList: (mdast.Image | mdast.Definition)[] = [];
  visit(node, "image", (node) => {
    imageList.push(node);
  });
  visit(node, "imageReference", (node) => {
    const maybeImage = definition(node.identifier)!;
    if (maybeImage) {
      imageList.push(maybeImage);
    }
  });
  if (imageList.length !== 0) {
    const promises = new Map<string, Promise<void>>();
    imageList.forEach(({ url }) => {
      if (images.has(url)) {
        return;
      }
      if (!promises.has(url)) {
        promises.set(
          url,
          (async () => {
            let data: ArrayBuffer;
            try {
              data = await loadImage(url);
            } catch (e) {
              warnOnce(`Failed to load image: ${url} ${e}`);
              return;
            }

            const { type, width, height } = imageSize(new Uint8Array(data));
            if (type === "png" || type === "jpg") {
              images.set(url, { type, data, width, height });
            } else if (type === "svg") {
              images.set(url, {
                type,
                data: new TextDecoder().decode(data),
                width,
                height,
              });
            } else {
              warnOnce(`Not supported image type: ${type}`);
            }
          })(),
        );
      }
    });
    await Promise.all(promises.values());
  }

  const defaultFont = fonts[0]!;
  const defaultFontName =
    typeof defaultFont === "string" ? defaultFont : defaultFont.name;

  const builders: NodeBuilders = {
    paragraph: buildParagraph,
    heading: buildHeading,
    thematicBreak: buildThematicBreak,
    blockquote: buildBlockquote,
    list: buildList,
    listItem: buildListItem,
    table: buildTable,
    tableRow: noop,
    tableCell: noop,
    html: fallbackText,
    code: fallbackText,
    definition: noop,
    // footnoteDefinition: buildFootnoteDefinition,
    text: buildText,
    emphasis: buildEmphasis,
    strong: buildStrong,
    delete: buildDelete,
    inlineCode: fallbackText,
    break: buildBreak,
    link: buildLink,
    linkReference: buildLinkReference,
    image: buildImage,
    imageReference: buildImageReference,
    // footnoteReference: buildFootnoteReference,
    math: fallbackText,
    inlineMath: fallbackText,
  };

  const context: Context = {
    render(nodes, c) {
      const results: PdfLayout[] = [];
      for (const node of nodes) {
        const builder = builders[node.type];
        if (!builder) {
          warnOnce(`${node.type} node is not supported without plugins.`);
          continue;
        }
        const r = builder(node as any, c ?? this);
        if (r) {
          if (Array.isArray(r)) {
            results.push(...r);
          } else {
            results.push(r);
          }
        }
      }
      return results;
    },
    style: {
      font: defaultFontName,
      fontSize: 12,
      color: "black",
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      ...defaultStyle,
    },
    textStyle,
    config: deepmerge<StyleOption>(
      {
        head1: {
          fontSize: 24,
        },
        head2: {
          fontSize: 22,
        },
        head3: {
          fontSize: 20,
        },
        head4: {
          fontSize: 18,
        },
        head5: {
          fontSize: 16,
        },
        head6: {
          fontSize: 14,
        },
        link: {
          color: "#0000FF",
          underline: true,
        },
      },
      style,
    ),
    images,
    definition,
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

  type RegisteredFont = {
    normal: string;
    bold?: string;
    italic?: string;
    bolditalic?: string;
  };
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
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
  });

  const getPageMaxX = (): number => doc.page.width - doc.page.margins.right;
  const getPageWidth = (): number =>
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const renderInlines = (
    nodes: readonly PdfLayout[],
    opts?: { width?: number; align?: Alignment; indent?: number },
    block?: { x: number; y: number },
  ) => {
    const items = nodes.filter((n) => n.type === "text" || n.type === "image");
    const startX =
      block?.x ??
      (typeof opts?.indent === "number"
        ? doc.page.margins.left + opts.indent
        : doc.x);
    const startY = block?.y ?? doc.y;
    let x = startX;
    let y = startY;
    let line: {
      node: PdfText | PdfImage;
      width: number;
      height: number;
      font?: string;
      text?: string;
      style?: TextStyle;
    }[] = [];

    const flushLine = () => {
      let cursorX = startX;
      let maxHeight = 0;
      if (line.length === 0) {
        maxHeight = doc.currentLineHeight();
      } else {
        for (const item of line) {
          if (item.height > maxHeight) maxHeight = item.height;
        }
      }
      for (const item of line) {
        if (item.node.type === "image") {
          if (item.node.data.type === "svg") {
            SVGtoPDF(doc, item.node.data.data, cursorX, y, {
              width: item.width,
              height: item.height,
            });
          } else {
            doc.image(item.node.data.data, cursorX, y, {
              width: item.width,
              height: item.height,
            });
          }
          cursorX += item.width;
        } else {
          const style = item.style!;
          doc.font(item.font!).fontSize(style.fontSize).fillColor(style.color);
          doc.text(item.text!, cursorX, y, {
            strike: style.strike,
            underline: style.underline,
            link: item.node.link ?? null,
            continued: false,
          });
          cursorX += item.width;
        }
      }
      y += maxHeight;
      x = startX;
      line = [];
    };

    for (const node of items) {
      if (node.type === "image") {
        let { width, height } = node.data;

        const pageWidth = getPageWidth();
        if (width > pageWidth) {
          const scale = pageWidth / width;
          width *= scale;
          height *= scale;
        }
        if (x + width > pageWidth) {
          flushLine();
        }
        line.push({ node, width, height });
        x += width;
        continue;
      }
      const style = node.style;
      let targetFont = fontMap.get(style.font);
      if (!targetFont) {
        targetFont = fontMap.get(defaultFontName)!;
      }
      let font = targetFont.normal;
      if (style.bold && style.italic && targetFont.bolditalic) {
        font = targetFont.bolditalic;
      } else if (style.bold && targetFont.bold) {
        font = targetFont.bold;
      } else if (style.italic && targetFont.italic) {
        font = targetFont.italic;
      }
      doc.font(font).fontSize(style.fontSize).fillColor(style.color);

      let buffer = "";
      for (const char of Array.from(node.text)) {
        const isNewline = char === "\n";
        const testStr = buffer + char;
        const w = doc.widthOfString(testStr);
        const h = doc.currentLineHeight();
        if (!isNewline && x + w > getPageMaxX()) {
          if (buffer) {
            line.push({
              node,
              width: doc.widthOfString(buffer),
              height: h,
              font,
              text: buffer,
              style,
            });
            x += doc.widthOfString(buffer);
            buffer = "";
          }
          flushLine();
        }
        if (isNewline) {
          if (buffer) {
            line.push({
              node,
              width: doc.widthOfString(buffer),
              height: h,
              font,
              text: buffer,
              style,
            });
            x += doc.widthOfString(buffer);
            buffer = "";
          }
          flushLine();
        } else {
          buffer += char;
        }
      }
      if (buffer) {
        const w = doc.widthOfString(buffer);
        const h = doc.currentLineHeight();
        line.push({ node, width: w, height: h, font, text: buffer, style });
        x += w;
      }
    }
    if (line.length > 0) {
      flushLine();
    }
    if (!block) {
      doc.x = x;
      doc.y = y;
    }
  };

  const listStack: number[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;

    switch (node.type) {
      case "paragraph": {
        if (node.list) {
          const { level, meta } = node.list;
          while (listStack.length > level + 1) {
            listStack.pop();
          }
          while (listStack.length <= level) {
            listStack.push(0);
          }
          if (meta.type === "ordered") {
            listStack[level]!++;
          }
          const num = listStack[level]!;

          renderInlines(
            [
              {
                type: "text",
                text:
                  meta.type === "ordered"
                    ? Decimal.renderMarker(num)
                    : Disc.renderMarker(num),
                style: (node.children[0]! as PdfText).style,
              },
              ...node.children,
            ],
            { indent: 10 * level },
          );
        } else {
          listStack.splice(0);
          renderInlines(node.children);
        }
        if (spacing) {
          doc.moveDown(spacing);
        }
        break;
      }
      case "text":
      case "image": {
        // fallback to block
        renderInlines([node]);
        break;
      }
      case "table": {
        const pageWidth = getPageWidth();
        const cellWidth = pageWidth / node.cells[0]!.length;
        const cellPadding = 2;
        const startX = doc.x;
        let y = doc.y;
        for (const row of node.cells) {
          let cellHeight = 0;
          for (let j = 0, x = startX; j < row.length; j++, x += cellWidth) {
            const cell = row[j]!;
            renderInlines(
              cell.children,
              {
                width: cellWidth - cellPadding * 2,
                align: node.align?.[j] ?? "left",
              },
              {
                x: x + cellPadding,
                y: y + cellPadding * 2,
              },
            );
            cellHeight = Math.max(cellHeight, doc.y - y);
          }

          for (let j = 0, x = startX; j < row.length; j++, x += cellWidth) {
            doc.rect(x, y, cellWidth, cellHeight).stroke();
          }

          y += cellHeight;
          doc.x = startX;
          doc.y = y;
        }
        break;
      }
      case "pagebreak": {
        doc.addPage();
        break;
      }
      default: {
        node satisfies never;
        break;
      }
    }
  }

  doc.end();
  return new Promise<ArrayBuffer>((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks).buffer);
    });
  });
}

const buildParagraph: NodeBuilder<"paragraph"> = ({ children }, ctx) => {
  return {
    type: "paragraph",
    children: ctx.render(children),
    list: ctx.list,
  };
};

const buildHeading: NodeBuilder<"heading"> = ({ children, depth }, ctx) => {
  const style = ctx.config[`head${depth}`];

  return {
    type: "paragraph",
    list: ctx.list,
    children: ctx.render(children, {
      ...ctx,
      style: {
        ...ctx.style,
        ...style,
      },
    }),
  };
};

const buildThematicBreak: NodeBuilder<"thematicBreak"> = () => {
  return {
    type: "pagebreak",
  };
};

const buildBlockquote: NodeBuilder<"blockquote"> = ({ children }, ctx) => {
  // FIXME: do nothing for now
  return ctx.render(children);
};

const buildList: NodeBuilder<"list"> = ({ children, ordered }, ctx) => {
  const parentList = ctx.list;
  return ctx.render(children, {
    ...ctx,
    list: {
      level: !parentList ? 0 : parentList.level + 1,
      meta: { type: ordered ? "ordered" : "bullet" },
    },
  });
};

const buildListItem: NodeBuilder<"listItem"> = ({ children, checked }, ctx) => {
  let list = ctx.list;
  if (list) {
    // listItem must be the child of list
    if (checked != null) {
      list = {
        level: list.level,
        meta: {
          type: "task",
          checked,
        },
      };
    }
  }
  return ctx.render(children, { ...ctx, list });
};

const buildTable: NodeBuilder<"table"> = ({ children, align }, ctx) => {
  const cellAligns: Alignment[] | undefined = align?.map((a) => a ?? "left");

  return {
    type: "table",
    align: cellAligns,
    cells: children.map((r) => {
      return r.children.map((c) => {
        return { children: ctx.render(c.children) };
      });
    }),
  };
};

const buildText: NodeBuilder<"text"> = ({ value: text }, ctx) => {
  const segments: PdfText[] = [];

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
  ): PdfText => {
    return {
      type: "text",
      text: text.slice(start, end),
      style: style,
      link: ctx.link,
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

const buildBreak: NodeBuilder<"break"> = ({}, ctx) => {
  return buildText({ type: "text", value: "\n" }, ctx);
};

const buildLink: NodeBuilder<"link"> = ({ children, url }, ctx) => {
  if (url.startsWith("#")) {
    // TODO support anchor link
    return ctx.render(children);
  }
  return ctx.render(children, {
    ...ctx,
    link: url,
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
  const image = ctx.images.get(node.url);
  if (!image) {
    return null;
  }
  return { type: "image", data: image };
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

const noop = () => {
  return null;
};

const fallbackText = (node: { type: string; value: string }, ctx: Context) => {
  warnOnce(
    `${node.type} node is not supported without plugins, falling back to text.`,
  );
  return buildText({ type: "text", value: node.value }, ctx);
};
