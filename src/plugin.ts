import type { Plugin } from "unified";
import { mdastToPdf, type PdfOptions } from "./mdast-util-to-pdf";

import type { Root } from "mdast";

export type { PdfOptions };

declare module "unified" {
  interface CompileResultMap {
    pdf: Promise<ArrayBuffer>;
  }
}

const plugin: Plugin<[PdfOptions?], Root, Promise<ArrayBuffer>> = function (
  opts,
) {
  this.compiler = (node) => {
    return mdastToPdf(node as Root, opts);
  };
};
export default plugin;
