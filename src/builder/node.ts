import { type PdfBuilder } from "../mdast-util-to-pdf";

import Printer from "pdfmake";
import { deepMerge } from "../utils";
import type { TFontDictionary } from "pdfmake/interfaces";

const defaultFonts: TFontDictionary = {
  Courier: {
    normal: "Courier",
    bold: "Courier-Bold",
    italics: "Courier-Oblique",
    bolditalics: "Courier-BoldOblique",
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
  Times: {
    normal: "Times-Roman",
    bold: "Times-Bold",
    italics: "Times-Italic",
    bolditalics: "Times-BoldItalic",
  },
  Symbol: {
    normal: "Symbol",
  },
  ZapfDingbats: {
    normal: "ZapfDingbats",
  },
};

const builder: PdfBuilder = (def) => {
  const printer = new Printer(deepMerge(defaultFonts, def.fonts));
  const pdf = printer.createPdfKitDocument(def);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => {
      const buf = Buffer.concat(chunks);
      return resolve(buf.buffer);
    });
    pdf.on("error", (e) => {
      reject(e);
    });
    pdf.end();
  });
};

export default builder;
