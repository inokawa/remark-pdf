// @ts-expect-error
import LineBreaker from "linebreak";
import type { Writeable } from "./utils";
import type { BlockNode, VoidNode, TextNode } from "./mdast-util-to-pdf";

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
  readonly contentTop: number;
  readonly contentWidth: number;
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
): LayoutBox[] => {
  const {
    contentTop,
    contentWidth,
    spacing,
    textWidth,
    textHeight,
    resolveFont,
    resolveImageSize,
  } = options;
  const result: LayoutBox[] = [];
  const inlines = children.filter(
    (c) => c.type === "text" || c.type === "void",
  );
  let y = Math.max(startY, contentTop);
  if (children.length !== inlines.length) {
    let afterPagebreak = false;
    for (let i = 0; i < children.length; i++) {
      const node = children[i]!;
      switch (node.type) {
        case "text":
        case "void": {
          if (afterPagebreak) {
            y = contentTop;
            afterPagebreak = false;
          }
          const childBoxes = layoutBlock(
            {
              type: "block",
              style: { display: "block" },
              children: [node],
            },
            startX,
            y,
            options,
          );
          if (childBoxes.length > 0) {
            result.push(...childBoxes);
            const lastBox = childBoxes[childBoxes.length - 1]!;
            if ("height" in lastBox) {
              y = lastBox.y + lastBox.height;
            }
          }
          break;
        }
        case "block": {
          if (afterPagebreak) {
            y = contentTop;
            afterPagebreak = false;
          }
          let childBoxes: LayoutBox[] = [];
          if (node.style && node.style.display === "table") {
            const rows = node.children.filter((c) => c.type === "block");
            if (!rows[0]) break;
            const colCount = rows[0].children.length;
            const cellWidth = contentWidth / colCount;
            const cellPadding = 2;
            let tableY = y;
            for (const row of rows) {
              const cells = row.children.filter((c) => c.type === "block");
              let cellHeight = 0;
              const cellBoxes: LayoutBox[][] = [];
              for (let colIdx = 0; colIdx < cells.length; colIdx++) {
                const cell = cells[colIdx]!;
                const boxes = measureInlines(
                  cell.children.filter(
                    (n) => n.type === "text" || n.type === "void",
                  ),
                  {
                    x: startX + colIdx * cellWidth + cellPadding,
                    y: tableY + cellPadding * 2,
                    align: cell.style.textAlign,
                    width: cellWidth - cellPadding * 2,
                  },
                  textWidth,
                  textHeight,
                  resolveFont,
                  resolveImageSize,
                );
                cellBoxes.push(boxes);
                const maxCellBottom = boxes.reduce(
                  (acc, b) => Math.max(acc, b.y + b.height),
                  tableY,
                );
                cellHeight = Math.max(cellHeight, maxCellBottom - tableY);
              }
              for (const boxes of cellBoxes) {
                childBoxes.push(...boxes);
              }
              for (let colIdx = 0; colIdx < cells.length; colIdx++) {
                childBoxes.push({
                  type: "block",
                  x: startX + colIdx * cellWidth,
                  y: tableY,
                  width: cellWidth,
                  height: cellHeight,
                });
              }
              tableY += cellHeight;
            }
            y = tableY;
          } else {
            childBoxes = layoutBlock(node, startX, y, options);
            const lastBox = childBoxes[childBoxes.length - 1]!;
            if ("height" in lastBox) {
              y = lastBox.y + lastBox.height;
            }
          }
          if (childBoxes.length > 0) {
            result.push(...childBoxes);
          }
          if (spacing) {
            y += spacing;
          }
          break;
        }
        case "pagebreak": {
          result.push({ type: "pagebreak" });
          afterPagebreak = true;
          break;
        }
        default: {
          node satisfies never;
        }
      }
    }
  } else {
    const boxes = measureInlines(
      inlines,
      {
        x: startX + (style.indent ?? 0),
        y: y,
        width: contentWidth,
      },
      textWidth,
      textHeight,
      resolveFont,
      resolveImageSize,
    );
    result.push(...boxes);
  }
  return result;
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
      case "void": {
        const size = resolveImageSize(node.attrs.src);
        let width = size?.width ?? 100; // TODO revisit
        let height = size?.height ?? 100; // TODO revisit
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
