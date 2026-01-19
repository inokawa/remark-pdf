// @ts-expect-error
import LineBreaker from "linebreak";
import type { Writeable } from "./utils";
import type { BlockNode, VoidNode, TextNode } from "./mdast-util-to-pdf";

const max = Math.max;

export type Alignment = "left" | "right" | "center";

export type RegisteredFont = {
  normal: string;
  bold?: string;
  italic?: string;
  bolditalic?: string;
};

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BlockBox extends Box {
  readonly type: "block";
  readonly border: boolean;
  readonly children: LayoutBox[];
}
export interface TextBox extends Box {
  readonly type: "text";
  readonly node: TextNode;
  readonly font: string;
  readonly text: string;
}
export interface ImageBox extends Box {
  readonly type: "image";
  readonly node: VoidNode;
}

type InlineBox = TextBox | ImageBox;

export type LayoutBox = InlineBox | BlockBox | { type: "pagebreak" };

export type TextWidth = (str: string) => number;
export type TextHeight = (font?: string, fontSize?: number) => number;
export type ResolveFont = (font: string) => RegisteredFont;
export type ResolveImageSize = (src: string) => {
  width: number;
  height: number;
} | null;

interface Options {
  readonly top: number;
  readonly width: number;
  readonly spacing?: number;
  readonly textWidth: TextWidth;
  readonly textHeight: TextHeight;
  readonly resolveFont: ResolveFont;
  readonly resolveImageSize: ResolveImageSize;
}

export const layoutBlock = (
  { children, style }: BlockNode,
  startX: number,
  startY: number,
  options: Options,
): BlockBox[] => {
  const {
    top,
    width,
    spacing,
    textWidth,
    textHeight,
    resolveFont,
    resolveImageSize,
  } = options;
  let y = max(startY, top);
  let height = 0;
  let border = false;
  const boxes: LayoutBox[] = [];

  if (style.display === "table-cell") {
    border = true;
    const cellPadding = 2;
    const inlineBoxes = measureInlines(
      children.filter((c) => c.type === "text" || c.type === "void"),
      {
        x: startX + cellPadding,
        y: y + cellPadding,
        align: style.textAlign,
        width: width - cellPadding * 2,
      },
      textWidth,
      textHeight,
      resolveFont,
      resolveImageSize,
    );
    boxes.push(...inlineBoxes);
    height =
      inlineBoxes.reduce((acc, b) => max(acc, b.y + b.height - y), 0) +
      cellPadding;
  } else if (style.display === "table") {
    const rows = children.filter((c) => c.type === "block");
    if (rows[0]) {
      const colCount = rows[0].children.length;
      const cellWidth = width / colCount;
      let tableY = y;
      for (const row of rows) {
        const cells = row.children.filter((c) => c.type === "block");
        let rowHeight = 0;
        const rowChildren: BlockBox[] = [];
        for (let colIdx = 0; colIdx < cells.length; colIdx++) {
          const cell = cells[colIdx]!;
          const cellBoxes = layoutBlock(
            cell,
            startX + colIdx * cellWidth,
            tableY,
            { ...options, width: cellWidth },
          );
          rowChildren.push(...cellBoxes);
          rowHeight = max(
            rowHeight,
            cellBoxes.reduce((acc, b) => max(acc, b.height), 0),
          );
        }
        boxes.push({
          type: "block",
          x: startX,
          y: tableY,
          width: width,
          height: rowHeight,
          border: false,
          children: rowChildren,
        });
        tableY += rowHeight;
      }
      height = tableY - y;
    }
  } else if (style.display === "block" || style.display === "table-row") {
    let afterPagebreak = false;
    const inlineBuffer: (TextNode | VoidNode)[] = [];

    const flush = () => {
      if (inlineBuffer.length > 0) {
        const inlineBoxes = measureInlines(
          inlineBuffer,
          {
            x: startX + (style.indent ?? 0),
            y: y,
            width: width,
          },
          textWidth,
          textHeight,
          resolveFont,
          resolveImageSize,
        );
        boxes.push(...inlineBoxes);
        if (inlineBoxes.length > 0) {
          const lastBox = inlineBoxes[inlineBoxes.length - 1]!;
          y = lastBox.y + lastBox.height;
        }
        inlineBuffer.splice(0);
      }
    };

    for (const node of children) {
      if (node.type === "pagebreak") {
        flush();
        boxes.push({ type: "pagebreak" });
        afterPagebreak = true;
        continue;
      }
      if (afterPagebreak) {
        y = top;
        afterPagebreak = false;
      }
      if (node.type === "block") {
        flush();
        const childBoxes = layoutBlock(node, startX, y, options);
        boxes.push(...childBoxes);
        if (childBoxes.length > 0) {
          const lastBox = childBoxes[childBoxes.length - 1]!;
          y = lastBox.y + lastBox.height;
        }
      } else if (node.type === "text" || node.type === "void") {
        inlineBuffer.push(node);
      }
      if (spacing) {
        if (node.type === "block") {
          y += spacing;
        }
      }
    }
    flush();

    height = y - startY;
  }

  return [
    {
      type: "block",
      x: startX,
      y: startY,
      width: width,
      height,
      border,
      children: boxes,
    },
  ];
};

const measureInlines = (
  items: readonly (TextNode | VoidNode)[],
  {
    x: startX,
    y: startY,
    width: wrapWidth,
    align = "left",
  }: { x: number; y: number; width: number; align?: Alignment },
  textWidth: TextWidth,
  textHeight: TextHeight,
  resolveFont: ResolveFont,
  resolveImageSize: ResolveImageSize,
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
      (acc, i) => max(acc, i.height),
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
      case "void": {
        const size = resolveImageSize(node.attrs.src);
        if (!size) {
          continue;
        }
        let width = size.width;
        let height = size.height;
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
