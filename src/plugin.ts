import type { Plugin } from "unified";
import { mdastToPdf, PdfOptions, ImageDataMap } from "./mdast-to-pdf";

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
(pdfMake as any).addVirtualFileSystem(pdfFonts);

export type { PdfOptions };

/**
 * Plugin for browser
 */
const plugin: Plugin<[PdfOptions?]> = function (opts = {}) {
  let images: ImageDataMap = {};

  this.Compiler = (node) => {
    return mdastToPdf(node as any, opts, images, (def) => {
      const pdf = pdfMake.createPdf(def);
      switch (opts.output ?? "buffer") {
        case "buffer":
          return new Promise((resolve) => {
            pdf.getBuffer(resolve);
          });
        case "blob":
          return new Promise((resolve) => {
            pdf.getBlob(resolve);
          });
      }
    });
  };
};
export default plugin;
