import type { Plugin } from "unified";
import { mdastToPdf, type PdfOptions, type ImageDataMap } from "./mdast-to-pdf";

import Printer from "pdfmake";
import { deepMerge, error } from "./utils";
import type { TFontDictionary } from "pdfmake/interfaces";
import type { Root } from "mdast";

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

export type { PdfOptions };

declare module "unified" {
  interface CompileResultMap {
    pdf: Promise<unknown>;
  }
}

/**
 * Plugin for Node.js
 */
const plugin: Plugin<[PdfOptions?], Root, Promise<unknown>> = function (
  opts = {}
) {
  let images: ImageDataMap = {};

  this.compiler = (node) => {
    return mdastToPdf(node as any, opts, images, (def) => {
      const printer = new Printer(deepMerge(defaultFonts, opts.fonts));
      const pdf = printer.createPdfKitDocument(def);

      return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        pdf.on("data", (chunk) => chunks.push(chunk));
        pdf.on("end", () => {
          const buf = Buffer.concat(chunks);
          switch (opts.output ?? "buffer") {
            case "buffer":
              return resolve(buf);
            case "blob":
              return error("unimplemented");
          }
        });
        pdf.on("error", (e) => {
          reject(e);
        });
        pdf.end();
      });
    });
  };
};
export default plugin;
