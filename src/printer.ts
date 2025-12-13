import { isEqualObject } from "./utils";
import { PageSizes, PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { LineBreaker } from "css-line-break";
import type { LineBreak } from "css-line-break/dist/types/LineBreak";
import type { FontType, PageSize, PdfContent, PdfParagraph } from "./types";

interface Font {
  normal: string;
  bold?: string;
  italic?: string;
  bolditalic?: string;
}

const courierFont: Font = {
  normal: "Courier",
  bold: "Courier-Bold",
  italic: "Courier-Oblique",
  bolditalic: "Courier-BoldOblique",
};
const helveticaFont: Font = {
  normal: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
  bolditalic: "Helvetica-BoldOblique",
};
const timesRomanFont: Font = {
  normal: "Times-Roman",
  bold: "Times-Bold",
  italic: "Times-Italic",
  bolditalic: "Times-BoldItalic",
};
const symbolFont: Font = {
  normal: "Symbol",
};
const zapfDingbatsFont: Font = {
  normal: "ZapfDingbats",
};

interface PrintableStyle {
  font: PDFFont;
  fontSize: number;
  height: number;
}
interface PrintableText {
  text: string;
  width: number;
  style: PrintableStyle;
}

export const printPdf = async (
  nodes: readonly PdfContent[],
  {
    pageSize: pageSizeProp,
    font: fontProp,
    margin: {
      top: marginTop,
      left: marginLeft,
      bottom: marginBottom,
      right: marginRight,
    },
  }: {
    pageSize: PageSize;
    font: FontType;
    margin: { top: number; left: number; bottom: number; right: number };
  },
): Promise<Uint8Array> => {
  // let font: Font;
  // if (typeof fontProp === "string") {
  //   font = helveticaFont;
  // }
  const fontDef = helveticaFont;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(fontDef.normal, { subset: true });
  const fontBold = fontDef.bold
    ? await doc.embedFont(fontDef.bold, { subset: true })
    : null;
  const fontItalic = fontDef.italic
    ? await doc.embedFont(fontDef.italic, { subset: true })
    : null;
  const fontBoldItalic = fontDef.bolditalic
    ? await doc.embedFont(fontDef.bolditalic, { subset: true })
    : null;

  const defaultFontSize = 10;
  const pageSize = PageSizes[pageSizeProp];
  const [pageWidth, pageHeight] = pageSize;

  const contentWidth = pageWidth - marginRight - marginLeft;
  const contentHeight = pageHeight - marginBottom - marginTop;

  const textWidthCache = new Map<string, number>();
  const textHeightCache = new Map<string, number>();
  const textWidth = (word: string, font: PDFFont, fontSize: number): number => {
    const key = `${font === fontBold ? 1 : font === fontItalic ? 2 : font === fontBoldItalic ? 3 : 0}_${fontSize}_${word}`;
    let width = textWidthCache.get(key);
    if (width == null) {
      textWidthCache.set(key, (width = font.widthOfTextAtSize(word, fontSize)));
    }
    return width;
  };
  const textHeight = (font: PDFFont, fontSize: number): number => {
    const key = `${font === fontBold ? 1 : font === fontItalic ? 2 : font === fontBoldItalic ? 3 : 0}_${fontSize}`;
    let height = textHeightCache.get(key);
    if (height == null) {
      textHeightCache.set(key, (height = font.heightAtSize(fontSize)));
    }
    return height;
  };

  const appendPage = () => {
    page = doc.addPage(pageSize);
    height = 0;
  };

  const appendHardBreak = () => {
    if (height > contentHeight) {
      appendPage();
    }
  };

  let height = 0;
  let page: PDFPage = doc.addPage(pageSize);

  const renderInlines = (nodes: readonly PdfContent[]): PrintableText[][] => {
    const lines: PrintableText[][] = [];
    let line: PrintableText[] = [];
    let text: PrintableText | undefined;
    let offset = 0;
    const addText = () => {
      if (text) {
        line.push(text);
        text = undefined;
      }
    };
    const addBreak = () => {
      addText();
      lines.push(line);
      line = [];
      offset = 0;
    };
    for (const node of nodes) {
      switch (node.type) {
        case "text": {
          const { text: nodeText, style: nodeStyle } = node;
          let nextFont: PDFFont = font;
          if (nodeStyle.bold && nodeStyle.italic && fontBoldItalic) {
            nextFont = fontBoldItalic;
          } else if (nodeStyle.bold && fontBold) {
            nextFont = fontBold;
          } else if (nodeStyle.italic && fontItalic) {
            nextFont = fontItalic;
          }

          const nextFontSize = nodeStyle.fontSize ?? defaultFontSize;
          const nextStyle: PrintableStyle = {
            fontSize: nextFontSize,
            font: nextFont,
            height: textHeight(nextFont, nextFontSize),
          };
          if (text && offset !== 0 && !isEqualObject(text.style, nextStyle)) {
            addText();
          }

          const texts = nodeText.split("\n");

          for (let i = 0; i < texts.length; i++) {
            const breaker = LineBreaker(texts[i]!, {
              lineBreak: "normal",
              wordBreak: "break-word",
            });
            let bk: LineBreak;
            while (!(bk = breaker.next()).done) {
              const word = bk.value.slice();

              const wordWidth = textWidth(
                word,
                nextStyle.font,
                nextStyle.fontSize,
              );
              if (offset + wordWidth > contentWidth) {
                addBreak();
              }

              if (!text) {
                text = {
                  text: "",
                  width: 0,
                  style: nextStyle,
                };
              }
              text.text += word;
              text.width += wordWidth;
              offset += wordWidth;
            }
            if (i < texts.length - 1) {
              addBreak();
            }
          }
          break;
        }
        default: {
          break;
        }
      }
    }

    addBreak();

    return lines;
  };

  const renderBlock = (node: PdfParagraph) => {
    const lines = renderInlines(node.children);

    for (const l of lines) {
      let offset = 0;
      let maxHeight = 0;
      for (const { text, width, style } of l) {
        page.drawText(text, {
          x: marginLeft + offset,
          y: -marginTop + pageHeight - style.height - height,
          size: style.fontSize,
          font: style.font,
        });
        offset += width;
        maxHeight = Math.max(maxHeight, style.height);
      }
      height += maxHeight;
      appendHardBreak();
    }
  };

  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        renderBlock(node);
        break;
      }
      case "text": {
        // fallback to block
        renderBlock({ type: "paragraph", children: [node] });
        break;
      }
      case "pagebreak": {
        appendPage();
        break;
      }
      default: {
        break;
      }
    }
  }

  return doc.save();
};
