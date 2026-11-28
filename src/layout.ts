// @ts-expect-error
import { LineBreaker } from "linebreak";
import bidiFactory from "bidi-js";
import type { TNode } from "@native-html/transient-render-engine";

// A rough browser layout of the tree TRE computes with remark-pdf's config,
// reading exactly the styles that config can produce.

export interface Style {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  color?: string;
  whiteSpace?: string;
  textAlign?: string;
  textDecorationLine?: string;
  listStyleType?: string;
  flexDirection?: string;
  flexGrow?: number;
  flexBasis?: number;
  marginTop?: number;
  marginBottom?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
}

type ComputedStyle = Style & { readonly fontSize: number };

// getNativeStyles of a block lacks the text styles it passes down
const computedStyleOf = (node: TNode): ComputedStyle => {
  const styles = node.styles;
  return {
    ...styles.nativeTextFlow,
    ...styles.webTextFlow,
    ...styles.nativeBlockFlow,
    ...styles.nativeTextRet,
    ...styles.nativeBlockRet,
    ...styles.webBlockRet,
  } as ComputedStyle;
};

type ColorProp =
  | "color"
  | "borderTopColor"
  | "borderRightColor"
  | "borderBottomColor"
  | "borderLeftColor";

const colorOf = (
  node: TNode | null,
  prop: ColorProp,
  style = node && computedStyleOf(node),
): string => {
  const value = style?.[prop]?.toLowerCase();
  if (!node || value == null) {
    return "black";
  }
  if (value === "inherit" || (value === "currentcolor" && prop === "color")) {
    return colorOf(node.parent, prop);
  }
  if (value === "currentcolor") {
    return colorOf(node, "color", style);
  }
  return value;
};

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

type Sides<T> = readonly [top: T, right: T, bottom: T, left: T];

interface Frame {
  readonly widths: Sides<number>;
  readonly colors: Sides<string>;
}

interface BlockBox extends Rect {
  readonly type: "block";
  // a row stretches its items to its height
  height: number;
  readonly children: readonly FlowBox[];
  readonly frame?: Frame;
  readonly row: boolean;
}

type FramedBox = BlockBox & { readonly frame: Frame };

// `bold` and `italic` are synthesized, as the face lacks them
interface Font {
  readonly name: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

interface TextFormat {
  readonly font: Font;
  readonly fontSize: number;
  readonly color: string;
  readonly decorations: readonly ("underline" | "line-through")[];
}

// at the bottom of its text in a line: pdfkit's documented API gives no
// ascent of standard fonts for a common baseline
interface TextBox extends Pick<Rect, "x" | "y"> {
  readonly type: "text";
  readonly text: string;
  readonly format: TextFormat;
  // text the layout adds (markers, hyphens), not of the document
  readonly added?: boolean;
}

interface ImageBox extends Rect {
  readonly type: "image";
  readonly src: string;
}

interface AnchorBox extends Pick<Rect, "x" | "y" | "height"> {
  readonly type: "anchor";
  readonly outline?: { readonly level: number; readonly title: string };
  readonly id?: string;
}

// a run of a link in a line
interface LinkBox extends Rect {
  readonly type: "link";
  readonly link: string;
}

type LineChild = TextBox | ImageBox | AnchorBox | LinkBox;

interface LineBox extends Pick<Rect, "y" | "height"> {
  readonly type: "line";
  readonly children: readonly LineChild[];
}

// the boxes of a block, which pages are made of
type FlowBox =
  | BlockBox
  | LineBox
  | AnchorBox
  | ({ readonly type: "pagebreak" } & Pick<Rect, "y" | "height">);

export type Box = FlowBox | LineChild;

type Anchor = Pick<AnchorBox, "outline" | "id">;

interface Marker {
  readonly text: string;
  readonly format: TextFormat;
  readonly x: number;
  readonly height: number;
  readonly lineHeight: number;
}

// What the first line laid out takes, leaving none: the markers of the items
// and the anchors of the elements it starts.
interface Lead {
  markers: Marker[];
  anchors: Anchor[];
}

const placeAnchor = (anchor: Anchor, x: number, y: number): AnchorBox => ({
  type: "anchor",
  ...anchor,
  x,
  y,
  height: 0,
});

// the markers at the bottom of the line's boxes, the anchors at its start
const takeLead = (
  lead: Lead,
  startX: number,
  y: number,
  bottom: number,
): LineChild[] => {
  const boxes: LineChild[] = lead.markers.map(
    ({ text, format, x, height }) => ({
      type: "text",
      x,
      y: bottom - height,
      text,
      format,
      added: true,
    }),
  );
  for (const anchor of lead.anchors) {
    boxes.push(placeAnchor(anchor, startX, y));
  }
  lead.markers = [];
  lead.anchors = [];
  return boxes;
};

interface LayoutOptions {
  readonly isPageBreak: (node: TNode) => boolean;
  readonly font: (style: Style) => Font;
  // with the font's line gap, which textHeight is without
  readonly lineHeight: (font: Font, fontSize: number) => number;
  readonly textHeight: (font: Font, fontSize: number) => number;
  readonly textWidth: (text: string, font: Font, fontSize: number) => number;
  readonly imageSize: (src: string) => {
    readonly width: number;
    readonly height: number;
  };
  readonly maxImageHeight: number;
}

export const layoutBlock = (
  node: TNode,
  x: number,
  y: number,
  width: number,
  opts: LayoutOptions,
  style = computedStyleOf(node),
  lead: Lead = { markers: [], anchors: [] },
): BlockBox => {
  const id = node.attributes["id"];
  // the printer titles headings, h1 to h6
  const title = node.attributes["dataTitle"];
  const anchor =
    id || title
      ? {
          id,
          outline: title
            ? { level: Number(node.tagName!.slice(1)), title }
            : undefined,
        }
      : undefined;
  if (anchor) {
    lead.anchors.push(anchor);
  }
  const {
    borderTopWidth = 0,
    borderRightWidth = 0,
    borderBottomWidth = 0,
    borderLeftWidth = 0,
    paddingTop = 0,
    paddingRight = 0,
    paddingBottom = 0,
    paddingLeft = 0,
  } = style;
  // a list's markers, right-aligned in its left padding widened to fit them;
  // the items with one are counted with all, as CSS does
  let left = borderLeftWidth + paddingLeft;
  const markers = new Map<TNode, Marker>();
  if (node.tagName === "ul" || node.tagName === "ol") {
    const { fontSize } = style;
    const font = opts.font(style);
    // mdast-util-to-hast gives a list a start only when it isn't 1
    const start = Number(node.attributes["start"] ?? 1);
    const marked: { readonly item: TNode; readonly text: string }[] = [];
    node.children.forEach((item, i) => {
      if (computedStyleOf(item).listStyleType !== "none") {
        marked.push({
          item,
          text:
            style.listStyleType === "decimal" ? `${start + i}. ` : "\u2022 ",
        });
      }
    });
    const widest = marked.at(-1)?.text;
    if (widest != null) {
      left = Math.max(
        left,
        Math.ceil(opts.textWidth(widest.replace(/\d/g, "0"), font, fontSize)),
      );
      const format: TextFormat = {
        font,
        fontSize,
        color: colorOf(node, "color", style),
        decorations: [],
      };
      const height = opts.textHeight(font, fontSize);
      const lineHeight = opts.lineHeight(font, fontSize);
      for (const { item, text } of marked) {
        markers.set(item, {
          text,
          format,
          x: x + left - opts.textWidth(text, font, fontSize),
          height,
          lineHeight,
        });
      }
    }
  }
  const contentX = x + left;
  const contentWidth = width - left - borderRightWidth - paddingRight;
  let nextY = y + borderTopWidth + paddingTop;
  const children: FlowBox[] = [];

  const row = style.flexDirection === "row";
  if (row) {
    const items = node.children;
    const styles = items.map(computedStyleOf);
    const free =
      contentWidth -
      styles.reduce((acc, { flexBasis = 0 }) => acc + flexBasis, 0);
    const grow = styles.reduce((acc, { flexGrow = 0 }) => acc + flexGrow, 0);
    let nextX = contentX;
    const boxes = items.map((item, i) => {
      const itemStyle = styles[i]!;
      const { flexGrow = 0, flexBasis = 0 } = itemStyle;
      const itemWidth = flexBasis + (grow ? (free * flexGrow) / grow : 0);
      const box = layoutBlock(
        item,
        nextX,
        nextY,
        itemWidth,
        opts,
        itemStyle,
        lead,
      );
      nextX += itemWidth;
      return box;
    });
    const height = boxes.reduce((acc, b) => Math.max(acc, b.height), 0);
    for (const b of boxes) {
      b.height = height;
    }
    children.push(...boxes);
    nextY += height;
  } else {
    node.children.forEach((child) => {
      if (opts.isPageBreak(child)) {
        children.push({ type: "pagebreak", y: nextY, height: 0 });
        return;
      }
      // TRE wraps the inline content between blocks in one node
      if (child.type !== "block") {
        const { lines, bottom } = layoutInlines(
          style,
          child,
          contentX,
          nextY,
          contentWidth,
          opts,
          lead,
        );
        children.push(...lines);
        nextY = bottom;
        return;
      }
      const childStyle = computedStyleOf(child);
      const { marginTop = 0, marginBottom = 0 } = childStyle;
      nextY += marginTop;
      const marker = markers.get(child);
      if (marker) {
        lead.markers.push(marker);
      }
      const box = layoutBlock(
        child,
        contentX,
        nextY,
        contentWidth,
        opts,
        childStyle,
        lead,
      );
      children.push(box);
      nextY = box.y + box.height + marginBottom;
    });
  }
  // an item without lines is a line of its markers
  if (node.tagName === "li" && lead.markers.length) {
    const height = Math.max(
      opts.lineHeight(opts.font(style), style.fontSize),
      ...lead.markers.map((m) => m.lineHeight),
    );
    const bottom = y + Math.max(...lead.markers.map((m) => m.height));
    children.unshift({
      type: "line",
      y,
      height,
      children: takeLead(lead, contentX, y, bottom),
    });
    nextY = Math.max(nextY, y + height);
  }
  // a block without lines has its anchors at its top
  if (anchor && lead.anchors.includes(anchor)) {
    children.unshift(...lead.anchors.map((a) => placeAnchor(a, x, y)));
    lead.anchors = [];
  }

  return {
    type: "block",
    x,
    y,
    width,
    height: nextY - y + borderBottomWidth + paddingBottom,
    children,
    frame:
      borderTopWidth || borderRightWidth || borderBottomWidth || borderLeftWidth
        ? {
            widths: [
              borderTopWidth,
              borderRightWidth,
              borderBottomWidth,
              borderLeftWidth,
            ],
            colors: [
              colorOf(node, "borderTopColor", style),
              colorOf(node, "borderRightColor", style),
              colorOf(node, "borderBottomColor", style),
              colorOf(node, "borderLeftColor", style),
            ],
          }
        : undefined,
    row,
  };
};

const SOFT_HYPHEN = "\u00ad";

const NEWLINES = /[\r\n\u2028\u2029]+$/;

const bidi = bidiFactory();

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The runs fontkit shapes right to left, by their first script: pdfkit passes
// it no direction.
const SHAPED_RTL =
  /^[\p{Script=Common}\p{Script=Inherited}\p{Script=Unknown}]*[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Cypriot}\p{Script=Kharoshthi}\p{Script=Phoenician}\p{Script=Nko}\p{Script=Lydian}\p{Script=Avestan}\p{Script=Imperial_Aramaic}\p{Script=Inscriptional_Pahlavi}\p{Script=Inscriptional_Parthian}\p{Script=Old_South_Arabian}\p{Script=Old_Turkic}\p{Script=Samaritan}\p{Script=Mandaic}\p{Script=Meroitic_Cursive}\p{Script=Meroitic_Hieroglyphs}\p{Script=Manichaean}\p{Script=Mende_Kikakui}\p{Script=Nabataean}\p{Script=Old_North_Arabian}\p{Script=Palmyrene}\p{Script=Psalter_Pahlavi}]/u;

const layoutInlines = (
  blockStyle: ComputedStyle,
  phrasing: TNode,
  startX: number,
  startY: number,
  wrapWidth: number,
  opts: LayoutOptions,
  lead: Lead,
): { lines: LineBox[]; bottom: number } => {
  const { textWidth } = opts;
  const { whiteSpace, textAlign } = blockStyle;
  const pre = whiteSpace === "pre";

  const { pieces, paragraph } = toPieces(phrasing, pre, wrapWidth, opts);

  const embedding = bidi.getEmbeddingLevels(paragraph);
  const { levels } = embedding;

  // the parts of the pieces the range of the paragraph has, with the text each
  // prints, without soft hyphens
  const partsOf = (
    from: number,
    to: number,
  ): (LinePart & { readonly from: number; readonly to: number })[] => {
    let i = 0;
    let hi = pieces.length;
    while (i < hi) {
      const mid = (i + hi) >> 1;
      if (pieces[mid]!.end <= from) {
        i = mid + 1;
      } else {
        hi = mid;
      }
    }
    const parts: ReturnType<typeof partsOf> = [];
    for (; i < pieces.length && pieces[i]!.start < to; i++) {
      const piece = pieces[i]!;
      const partFrom = Math.max(from, piece.start);
      const partTo = Math.min(to, piece.end);
      if (piece.type === "image") {
        parts.push({
          piece,
          text: "",
          width: piece.width,
          from: partFrom,
          to: partTo,
        });
      } else {
        const text = paragraph
          .slice(partFrom, partTo)
          .replaceAll(SOFT_HYPHEN, "");
        parts.push({
          piece,
          text,
          width: textWidth(text, piece.font, piece.fontSize),
          from: partFrom,
          to: partTo,
        });
      }
    }
    return parts;
  };
  const widthOf = (from: number, to: number): number =>
    partsOf(from, to).reduce((acc, part) => acc + part.width, 0);

  // a line of a range of the paragraph, wrapped or not; a forced break ending
  // it is in it, as tall as its style, but not printed
  const layoutLine = (
    { from: lineFrom, to: lineTo, wrapped, breakEnd }: LineRange,
    y: number,
  ): LineBox => {
    // spaces at the end don't count, nor, in pre, the ones past the line
    let end = lineTo;
    while (
      end > lineFrom &&
      /\s/.test(paragraph[end - 1]!) &&
      (!pre || widthOf(lineFrom, end) > wrapWidth)
    ) {
      end--;
    }
    const line = partsOf(lineFrom, end).filter(
      ({ piece, text }) => piece.type === "image" || text,
    );
    // with the spaces dropped at its end; an empty line of the block's font
    const spanned = partsOf(lineFrom, breakEnd ?? lineTo);
    const height = Math.max(
      spanned.length
        ? 0
        : opts.lineHeight(opts.font(blockStyle), blockStyle.fontSize),
      ...spanned.map(({ piece }) => piece.lineHeight),
      ...lead.markers.map((m) => m.lineHeight),
    );
    // placed in visual order, painted in reading order, by the embedding
    // levels of the paragraph and UAX #9's rules for a line. pdfkit shapes
    // each word with fontkit, which turns a right-to-left one: words at an
    // odd level are parts of their own, and other text there is turned here.
    // The line's own order, by reversing its segments: getReorderedIndices
    // orders the whole paragraph for each line.
    const order = Array.from(
      { length: end - lineFrom },
      (_, i) => lineFrom + i,
    );
    for (const segment of bidi.getReorderSegments(
      paragraph,
      embedding,
      lineFrom,
      end - 1,
    )) {
      const at = segment[0]! - lineFrom;
      const reversed = order.slice(at, segment[1]! - lineFrom + 1).reverse();
      order.splice(at, reversed.length, ...reversed);
    }
    const places = new Map(order.map((index, place) => [index, place]));
    // the parts in reading order, each at the visual place of its first
    // character, and the x it is placed at
    const atoms: {
      readonly part: LinePart;
      readonly place: number;
      x: number;
    }[] = [];
    for (const part of line) {
      const { piece, text: whole, from, to } = part;
      if (piece.type !== "text") {
        atoms.push({ part, place: places.get(from)!, x: 0 });
        continue;
      }
      // soft hyphens take the level of the character before them (BN)
      const runs: (readonly [start: number, end: number, level: number])[] = [];
      for (let i = from, start = from; i <= to; i++) {
        const level = levels[start]!;
        if (
          i === to ||
          levels[i] !== level ||
          // a word ends at an odd level
          (level % 2 === 1 &&
            i > start &&
            /\s/.test(paragraph[i - 1]!) &&
            !/\s/.test(paragraph[i]!))
        ) {
          runs.push([start, i, level]);
          start = i;
        }
      }
      for (const [runStart, runEnd, level] of runs) {
        const odd = level % 2 === 1;
        const chars = Array.from(
          paragraph.slice(runStart, runEnd).replaceAll(SOFT_HYPHEN, ""),
          (c) => (odd && bidi.getMirroredCharacter(c)) || c,
        );
        if (!chars.length) {
          continue;
        }
        const run = chars.join("");
        const text =
          odd && !SHAPED_RTL.test(run) ? chars.reverse().join("") : run;
        const place = places.get(runStart)!;
        if (runs.length === 1 && text === whole) {
          atoms.push({ part, place, x: 0 });
          continue;
        }
        atoms.push({
          part: {
            piece,
            text,
            width: textWidth(text, piece.font, piece.fontSize),
          },
          place,
          x: 0,
        });
      }
    }
    let width = atoms.reduce((acc, { part }) => acc + part.width, 0);
    // a hyphen where the line wraps at a soft hyphen, if it fits, after the
    // last part
    const tail = atoms.at(-1);
    if (
      wrapped &&
      paragraph[lineTo - 1] === SOFT_HYPHEN &&
      tail?.part.piece.type === "text"
    ) {
      const piece = tail.part.piece;
      const hyphen: LinePart = {
        piece,
        text: "-",
        width:
          textWidth(tail.part.text + "-", piece.font, piece.fontSize) -
          tail.part.width,
        added: true,
      };
      if (width + hyphen.width <= wrapWidth) {
        atoms.push({ part: hyphen, place: tail.place + 0.5, x: 0 });
        width += hyphen.width;
      }
    }
    const rtl =
      embedding.paragraphs.find((p) => lineFrom <= p.end)?.level === 1;
    let pen = startX;
    if (textAlign === "center") {
      pen += (wrapWidth - width) / 2;
    } else if (textAlign === "right" || (textAlign !== "left" && rtl)) {
      pen += wrapWidth - width;
    }
    // the x of each part, and the runs of the parts of each link, in visual
    // order
    const links: { readonly link: string; readonly atoms: typeof atoms }[] = [];
    let previous: string | undefined;
    for (const atom of atoms.toSorted((a, b) => a.place - b.place)) {
      atom.x = pen;
      pen += atom.part.width;
      const { link } = atom.part.piece;
      if (link) {
        if (link === previous) {
          links.at(-1)!.atoms.push(atom);
        } else {
          links.push({ link, atoms: [atom] });
        }
      }
      previous = link;
    }
    const bottom =
      y +
      Math.max(
        0,
        ...atoms.map(({ part }) => part.piece.height),
        ...lead.markers.map((m) => m.height),
      );
    const children = takeLead(lead, startX, y, bottom);
    for (const { part, x } of atoms) {
      const { piece } = part;
      children.push(
        piece.type === "image"
          ? {
              type: "image",
              src: piece.src,
              x,
              y: bottom - piece.height,
              width: part.width,
              height: piece.height,
            }
          : {
              type: "text",
              x,
              y: bottom - piece.height,
              text: part.text,
              format: piece,
              added: part.added,
            },
      );
    }
    for (const { link, atoms: run } of links) {
      const first = run[0]!;
      const last = run.at(-1)!;
      const runHeight = Math.max(...run.map(({ part }) => part.piece.height));
      children.push({
        type: "link",
        link,
        x: first.x,
        y: bottom - runHeight,
        width: last.x + last.part.width - first.x,
        height: runHeight,
      });
    }
    return { type: "line", y, height, children };
  };

  // where the lines break, by UAX #14
  const breakLines = (): LineRange[] => {
    const ranges: LineRange[] = [];
    let lineFrom = 0;
    let lineTo = 0;
    let lineWidth = 0;
    const extend = (from: number, to: number): void => {
      if (from < to) {
        lineTo = to;
        lineWidth += widthOf(from, to);
      }
    };
    const breakLine = (wrapped: boolean, breakEnd?: number): void => {
      ranges.push({ from: lineFrom, to: lineTo, wrapped, breakEnd });
      lineFrom = lineTo = breakEnd ?? lineTo;
      lineWidth = 0;
    };
    const breaker = new LineBreaker(paragraph);
    let from = 0;
    let opportunity;
    while ((opportunity = breaker.nextBreak())) {
      const { position, required } = opportunity;
      const to = required
        ? from + paragraph.slice(from, position).replace(NEWLINES, "").length
        : position;
      const visibleEnd = from + paragraph.slice(from, to).trimEnd().length;
      const visibleWidth = widthOf(from, visibleEnd);
      if (
        to > from &&
        lineWidth + visibleWidth > wrapWidth &&
        lineTo > lineFrom
      ) {
        breakLine(true);
      }
      if (visibleWidth > wrapWidth) {
        const ends = Array.from(
          graphemes.segment(paragraph.slice(from, visibleEnd)),
          ({ index, segment }) => from + index + segment.length,
        );
        let at = from;
        let next = 0;
        while (at < visibleEnd) {
          let cut = at;
          while (next < ends.length && widthOf(at, ends[next]!) <= wrapWidth) {
            cut = ends[next++]!;
          }
          if (cut === visibleEnd) {
            break;
          }
          if (cut === at) {
            cut = ends[next++]!;
          }
          extend(at, cut);
          breakLine(false);
          at = cut;
        }
        extend(at, to);
      } else {
        extend(from, to);
      }
      if (required) {
        breakLine(false, position);
      }
      from = position;
    }
    if (lineTo > lineFrom) {
      breakLine(false);
    }
    return ranges;
  };

  const lines: LineBox[] = [];
  let y = startY;
  for (const range of breakLines()) {
    const line = layoutLine(range, y);
    lines.push(line);
    y += line.height;
  }
  return { lines, bottom: y };
};

interface LineRange {
  readonly from: number;
  readonly to: number;
  readonly wrapped: boolean;
  // the end of a forced break ending the line
  readonly breakEnd?: number;
}

type Piece = {
  // its range of the paragraph
  readonly start: number;
  readonly end: number;
  // of the text, or the image; lineHeight adds a font's line gap
  readonly height: number;
  readonly lineHeight: number;
  readonly link: string | undefined;
} & (
  | ({ readonly type: "text" } & TextFormat)
  | {
      readonly type: "image";
      readonly src: string;
      readonly width: number;
    }
);

const toPieces = (
  phrasing: TNode,
  pre: boolean,
  wrapWidth: number,
  opts: LayoutOptions,
): { pieces: readonly Piece[]; paragraph: string } => {
  const pieces: Piece[] = [];
  let paragraph = "";
  let column = 0;
  const expandTabs = (text: string): string => {
    let out = "";
    for (const ch of text) {
      if (ch === "\t") {
        const spaces = 8 - (column % 8);
        out += " ".repeat(spaces);
        column += spaces;
      } else {
        out += ch;
        column = NEWLINES.test(ch) ? 0 : column + 1;
      }
    }
    return out;
  };
  // `outer`: the link the node is in
  const visit = (node: TNode, outer: string | undefined): void => {
    const start = paragraph.length;
    // TRE merges a text-only anchor into its text node
    const href = node.attributes["href"];
    const link = node.tagName === "a" && href ? href : outer;
    switch (node.type) {
      case "phrasing":
        node.children.forEach((child) => visit(child, link));
        break;
      // text, as TRE makes br and img too
      case "text":
        switch (node.tagName) {
          case "br":
            paragraph += "\n";
            break;
          case "img": {
            const src = node.attributes["src"]!;
            const size = opts.imageSize(src);
            const scale = Math.min(
              1,
              wrapWidth / size.width,
              opts.maxImageHeight / size.height,
            );
            const height = size.height * scale;
            pieces.push({
              type: "image",
              start,
              end: start + 1,
              src,
              width: size.width * scale,
              height,
              lineHeight: height,
              link,
            });
            paragraph += "\ufffc";
            break;
          }
          default: {
            const style = computedStyleOf(node);
            const text = pre ? expandTabs(node.data) : node.data;
            const { fontSize } = style;
            if (!fontSize || !text) {
              return;
            }
            const font = opts.font(style);
            // every ancestor's, as CSS propagates them: TRE passes down only
            // the nearest https://github.com/meliorence/react-native-render-html/issues/529
            let declared = "";
            for (let n: TNode | null = node; n; n = n.parent) {
              declared += ` ${computedStyleOf(n).textDecorationLine ?? ""}`;
            }
            pieces.push({
              type: "text",
              start,
              end: start + text.length,
              font,
              fontSize,
              height: opts.textHeight(font, fontSize),
              lineHeight: opts.lineHeight(font, fontSize),
              color: colorOf(node, "color", style),
              decorations: (["underline", "line-through"] as const).filter(
                (line) => declared.includes(line),
              ),
              link,
            });
            paragraph += text;
          }
        }
    }
  };
  visit(phrasing, undefined);
  return { pieces, paragraph };
};

// The text of a piece, or an image, in a line.
interface LinePart {
  readonly piece: Piece;
  readonly text: string;
  readonly width: number;
  // a hyphen the layout adds
  readonly added?: boolean;
}

export interface Page {
  readonly boxes: readonly FlowBox[];
  readonly offsetY: number;
  readonly frames: readonly FramedBox[];
  readonly frameHeight: number;
}

// Painters subtract `offsetY` from each box's y.
export const paginate = (
  root: BlockBox,
  contentHeight: number,
  contentTop: number,
): readonly Page[] => {
  const order = new Map<FlowBox, number>();
  // a row's items keep together, unless the row is taller than a page;
  // `order` is the reading order, which pages are painted in
  const asUnit = (b: FlowBox): FlowBox => {
    order.set(b, order.size);
    return b;
  };
  const collectUnits = (box: FlowBox): FlowBox[] => {
    if (box.type !== "block" || box.children.length === 0) {
      return [asUnit(box)];
    }
    if (!box.row) {
      return box.children.flatMap(collectUnits);
    }
    if (box.height <= contentHeight) {
      return box.children.map(asUnit);
    }
    return box.children
      .flatMap((cell) => (cell.type === "block" ? cell.children : []))
      .flatMap(collectUnits)
      .sort((a, b) => a.y - b.y);
  };
  const units = collectUnits(root);
  // the first page keeps the top border and padding of the first blocks
  const packed: { readonly boxes: readonly FlowBox[]; readonly top: number }[] =
    [];
  let page: FlowBox[] = [];
  let pageTop: number | undefined = contentTop;
  const breakPage = (): void => {
    packed.push({
      boxes: page.sort((a, b) => order.get(a)! - order.get(b)!),
      top: pageTop ?? contentTop,
    });
    page = [];
    pageTop = undefined;
  };
  for (const box of units) {
    if (box.type === "pagebreak") {
      breakPage();
      continue;
    }
    if (page.length && box.y + box.height - pageTop! > contentHeight) {
      breakPage();
    }
    pageTop ??= box.y;
    page.push(box);
  }
  breakPage();
  const frames: FramedBox[] = [];
  const collectFrames = (box: FlowBox): void => {
    if (box.type === "block") {
      if (box.frame) {
        frames.push(box as FramedBox);
      }
      box.children.forEach(collectFrames);
    }
  };
  collectFrames(root);
  // a frame shows up to where the next page with content starts
  const pages: Page[] = [];
  let nextTop = Infinity;
  for (let i = packed.length - 1; i >= 0; i--) {
    const { boxes, top } = packed[i]!;
    const bottom = Math.min(top + contentHeight, nextTop);
    pages[i] = {
      boxes,
      offsetY: top - contentTop,
      frames: boxes.length
        ? frames.filter((f) => f.y < bottom && f.y + f.height > top)
        : [],
      frameHeight: bottom - top,
    };
    if (boxes.length) {
      nextTop = top;
    }
  }
  return pages;
};
