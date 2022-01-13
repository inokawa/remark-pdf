import type { Plugin } from "unified";
import * as mdast from "mdast";
import { visit } from "unist-util-visit";
import { mdastToPdf, Opts, ImageDataMap } from "./transformer";

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
(<any>pdfMake).vfs = pdfFonts.pdfMake.vfs;

export type Options = Opts;

const plugin: Plugin<[Options?]> = function (opts = {}) {
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
