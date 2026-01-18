import type * as mdast from "mdast";
import PDFDocument from "pdfkit";
// @ts-expect-error
import SVGtoPDF from "svg-to-pdfkit";
import Decimal from "@jsamr/counter-style/presets/decimal";
import Disc from "@jsamr/counter-style/presets/disc";
import { definitions, type GetDefinition } from "mdast-util-definitions";
import deepmerge from "deepmerge";
import { warnOnce, type Writeable } from "./utils";
import imageSize from "image-size";
import { visit } from "unist-util-visit";
// @ts-expect-error
import LineBreaker from "linebreak";

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

interface BlockStyle {
  indent?: number;
  display: "block" | "table" | "table-row" | "table-cell";
  textAlign?: Alignment;
}
interface PdfBlock {
  type: "block";
  style: BlockStyle;
  children: PdfLayout[];
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

type PdfLayout = PdfBlock | PdfPageBreak | PdfText | PdfImage;

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

type RegisteredFont = {
  normal: string;
  bold?: string;
  italic?: string;
  bolditalic?: string;
};

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

  const contentWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const contentHeight =
    doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const contentTop = doc.page.margins.top;
  const contentLeft = doc.page.margins.left;

  const textWidth = (text: string): number => doc.widthOfString(text);
  const textHeight = (font?: string, fontSize?: number): number => {
    if (font != null && fontSize != null) {
      doc.font(font).fontSize(fontSize);
    }
    return doc.currentLineHeight();
  };
  const resolveFont = (font: string): RegisteredFont => {
    let targetFont = fontMap.get(font);
    if (!targetFont) {
      targetFont = fontMap.get(defaultFontName)!;
    }
    return targetFont;
  };

  const printBlock = (root: PdfBlock) => {
    const inlines = root.children.filter(
      (c) => c.type === "text" || c.type === "image",
    );
    if (root.children.length !== inlines.length) {
      for (const node of root.children) {
        switch (node.type) {
          case "text":
          case "image": {
            printBlock({
              type: "block",
              style: { display: "block" },
              children: [node],
            });
            break;
          }
          case "block": {
            if (node.style.display === "table") {
              const rows = node.children.filter((c) => c.type === "block");
              const colCount = rows[0]!.children.length;
              const cellWidth = contentWidth / colCount;
              const cellPadding = 2;
              const startX = doc.x;
              let y = doc.y;
              for (const row of rows) {
                const cells = row.children.filter((c) => c.type === "block");
                let cellHeight = 0;
                let x = startX;
                for (const cell of cells) {
                  const boxes = measureInlines(
                    cell.children.filter(
                      (n) => n.type === "text" || n.type === "image",
                    ),
                    {
                      x: x + cellPadding,
                      y: y + cellPadding * 2,
                      align: cell.style.textAlign,
                      width: cellWidth - cellPadding * 2,
                    },
                    textWidth,
                    textHeight,
                    resolveFont,
                  );
                  printInlines(boxes, doc);
                  const maxCellBottom = boxes.reduce(
                    (acc, b) => Math.max(acc, b.y + b.height),
                    y,
                  );
                  cellHeight = Math.max(cellHeight, maxCellBottom - y);
                  x += cellWidth;
                }
                x = startX;
                for (const _ of cells) {
                  printCell(
                    { x, y, width: cellWidth, height: cellHeight },
                    doc,
                  );
                  x += cellWidth;
                }
                y += cellHeight;
                doc.x = startX;
                doc.y = y;
              }
            } else {
              printBlock(node);
            }
            break;
          }
          case "pagebreak": {
            doc.addPage();
            break;
          }
          default: {
            node satisfies never;
          }
        }
      }
    } else {
      const style = root.style;
      let startY = doc.y;
      let boxes = measureInlines(
        inlines,
        {
          x: contentLeft + (style.indent ?? 0),
          y: startY,
          width: contentWidth,
        },
        textWidth,
        textHeight,
        resolveFont,
      );
      let pageStart = 0;
      while (pageStart < boxes.length) {
        let pageEnd = pageStart;
        while (pageEnd < boxes.length) {
          const box = boxes[pageEnd]!;
          if (box.y + box.height <= contentHeight) {
            pageEnd++;
          } else {
            break;
          }
        }
        if (pageEnd === pageStart) {
          pageEnd = pageStart + 1;
        }
        const pageBoxes = boxes.slice(pageStart, pageEnd);
        printInlines(pageBoxes, doc);
        doc.y = pageBoxes.reduce(
          (acc, b) => Math.max(acc, b.y + b.height),
          startY,
        );
        pageStart = pageEnd;
        if (pageStart < boxes.length) {
          doc.addPage();
          startY = contentTop;
          const yOffset = contentTop - boxes[pageStart]!.y;
          for (let i = pageStart; i < boxes.length; i++) {
            const box = boxes[i]!;
            boxes[i] = { ...box, y: box.y + yOffset };
          }
        }
      }
      if (spacing) {
        doc.y += spacing;
      }
    }
  };

  printBlock({ type: "block", style: { display: "block" }, children: nodes });

  doc.end();
  return new Promise<ArrayBuffer>((resolve) => {
    doc.on("end", () => {
      resolve(Buffer.concat(chunks).buffer);
    });
  });
}

const measureInlines = (
  items: readonly (PdfText | PdfImage)[],
  {
    x: startX,
    y: startY,
    width: wrapWidth,
    align = "left",
  }: { x: number; y: number; width: number; align?: Alignment },
  textWidth: (str: string) => number,
  textHeight: (font?: string, fontSize?: number) => number,
  resolveFont: (font: string) => RegisteredFont,
): InlineBox[] => {
  let x = startX;
  let y = startY;
  let line: Writeable<InlineBox>[] = [];
  const boxes: InlineBox[] = [];

  const flushLine = () => {
    if (line.length === 0) {
      y += textHeight();
      x = startX;
      return;
    }
    const lineWidth = line.reduce((acc, i) => acc + i.width, 0);
    const lineHeight = line.reduce(
      (acc, i) => Math.max(acc, i.height),
      textHeight(),
    );

    const baselineY = y + lineHeight;
    let cursorX = startX;
    if (align === "center") {
      cursorX += (wrapWidth - lineWidth) / 2;
    } else if (align === "right") {
      cursorX += wrapWidth - lineWidth;
    }
    for (const item of line) {
      item.x = cursorX;
      item.y = baselineY - item.height;

      boxes.push(item);
      cursorX += item.width;
    }
    y += lineHeight;
    x = startX;
    line = [];
  };

  for (const node of items) {
    switch (node.type) {
      case "image": {
        let { width, height } = node.data;
        if (width > wrapWidth) {
          const scale = wrapWidth / width;
          width *= scale;
          height *= scale;
        }
        if (x + width > startX + wrapWidth) {
          if (line.length) flushLine();
          line.push({ type: "image", node, x: 0, y: 0, width, height });
          flushLine();
        } else {
          line.push({ type: "image", node, x: 0, y: 0, width, height });
          x += width;
        }
        break;
      }
      case "text": {
        const { style, text } = node;
        if (!style.fontSize) {
          continue;
        }
        const targetFont = resolveFont(style.font);
        let font = targetFont.normal;
        if (style.bold && style.italic && targetFont.bolditalic) {
          font = targetFont.bolditalic;
        } else if (style.bold && targetFont.bold) {
          font = targetFont.bold;
        } else if (style.italic && targetFont.italic) {
          font = targetFont.italic;
        }
        const lineHeight = textHeight(font, style.fontSize);
        const breaker = new LineBreaker(text);
        const words: { word: string; required: boolean }[] = [];
        let last = 0;
        let bk;
        while ((bk = breaker.nextBreak())) {
          words.push({
            word: text.slice(last, bk.position),
            required: bk.required,
          });
          last = bk.position;
        }
        let buffer = "";
        let w = 0;
        const pushText = (t: string, w: number) => {
          line.push({
            type: "text",
            node,
            x: 0,
            y: 0,
            width: w,
            height: lineHeight,
            font,
            text: t,
          });
          x += w;
        };
        const flush = (alsoLine: boolean) => {
          if (buffer) {
            pushText(buffer, w);
            buffer = "";
            w = 0;
          }
          if (alsoLine) {
            flushLine();
          }
        };
        for (const { word, required } of words) {
          if (word === "\n") {
            flush(true);
            continue;
          }
          const wordWidth = textWidth(word);
          if (wordWidth > wrapWidth) {
            for (let i = 0; i < word.length; ) {
              let chunk = word[i]!;
              for (let l = 1; i + l <= word.length; l++) {
                const slice = word.slice(i, i + l);
                if (textWidth(slice) > wrapWidth) {
                  break;
                }
                chunk = slice;
              }
              pushText(chunk, textWidth(chunk));
              flush(true);
              i += chunk.length;
            }
            continue;
          }
          if (x + w + wordWidth > startX + wrapWidth) {
            flush(true);
          }
          buffer += word;
          w += wordWidth;
          if (required && buffer) {
            flush(true);
          }
        }
        flush(false);
        break;
      }
    }
  }
  if (line.length > 0) {
    flushLine();
  }
  return boxes;
};

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface BlockBox extends Box {}
interface TextBox extends Box {
  readonly type: "text";
  readonly node: PdfText;
  readonly font: string;
  readonly text: string;
}
interface ImageBox extends Box {
  readonly type: "image";
  readonly node: PdfImage;
}

type InlineBox = TextBox | ImageBox;

const printCell = (box: BlockBox, doc: PDFKit.PDFDocument) => {
  doc.rect(box.x, box.y, box.width, box.height).stroke();
};

const printInlines = (boxes: readonly InlineBox[], doc: PDFKit.PDFDocument) => {
  for (const box of boxes) {
    if (box.type === "text") {
      const style = box.node.style;
      doc.font(box.font).fontSize(style.fontSize).fillColor(style.color);
      doc.text(box.text, box.x, box.y, {
        strike: style.strike,
        underline: style.underline,
        link: box.node.link ?? null,
        continued: false,
      });
    } else {
      const data = box.node.data;
      if (data.type === "svg") {
        SVGtoPDF(doc, data.data, box.x, box.y, {
          width: box.width,
          height: box.height,
        });
      } else {
        doc.image(data.data, box.x, box.y, {
          width: box.width,
          height: box.height,
        });
      }
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

const buildHeading: NodeBuilder<"heading"> = ({ children, depth }, ctx) => {
  return ctx.render([{ type: "paragraph", children }], {
    ...ctx,
    style: { ...ctx.style, ...ctx.config[`head${depth}`] },
  });
};

const buildThematicBreak: NodeBuilder<"thematicBreak"> = () => {
  return {
    type: "pagebreak",
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
