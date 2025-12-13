import type { Plugin } from "unified";
import { mdastToPdf, type PdfOptions } from "./mdast-util-to-pdf";

import type { Root } from "mdast";

export type { PdfOptions };

declare module "unified" {
  interface CompileResultMap {
    pdf: Promise<Uint8Array>;
  }
}

const plugin: Plugin<[PdfOptions?], Root, Promise<Uint8Array>> = function (
  opts = {}
) {
  this.compiler = (node) => {
    return mdastToPdf(node as Root, opts);
  };
};
export default plugin;
