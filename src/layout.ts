// @ts-expect-error
import LineBreaker from "linebreak";
import type { Writeable } from "./utils";
import type { PdfImage, PdfText } from "./mdast-util-to-pdf";

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

export interface BlockBox extends Box {}
export interface TextBox extends Box {
  readonly type: "text";
  readonly node: PdfText;
  readonly font: string;
  readonly text: string;
}
export interface ImageBox extends Box {
  readonly type: "image";
  readonly node: PdfImage;
}

export type InlineBox = TextBox | ImageBox;

export type TextWidth = (str: string) => number;
export type TextHeight = (font?: string, fontSize?: number) => number;
export type ResolveFont = (font: string) => RegisteredFont;

export const measureInlines = (
  items: readonly (PdfText | PdfImage)[],
  {
    x: startX,
    y: startY,
    width: wrapWidth,
    align = "left",
  }: { x: number; y: number; width: number; align?: Alignment },
  textWidth: TextWidth,
  textHeight: TextHeight,
  resolveFont: ResolveFont,
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
