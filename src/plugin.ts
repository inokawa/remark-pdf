import type { Plugin } from "unified";
import { mdastToPdf, type PdfOptions, type ImageDataMap } from "./mdast-to-pdf";

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import type { Root } from "mdast";
(pdfMake as any).addVirtualFileSystem(pdfFonts);

export type { PdfOptions };

declare module "unified" {
  interface CompileResultMap {
    pdf: Promise<unknown>;
  }
}

/**
 * Plugin for browser
 */
const plugin: Plugin<[PdfOptions?], Root, Promise<unknown>> = function (
  opts = {}
) {
  let images: ImageDataMap = {};

  this.compiler = (node) => {
    return mdastToPdf(node as Root, opts, images, (def) => {
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
