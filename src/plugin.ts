import type { Plugin } from "unified";
import { mdastToPdf, type PdfOptions } from "./mdast-util-to-pdf";

import type { Root } from "mdast";
import { isBrowser } from "./utils";

export type { PdfOptions };

declare module "unified" {
  interface CompileResultMap {
    pdf: Promise<ArrayBuffer>;
  }
}

const plugin: Plugin<[PdfOptions?], Root, Promise<ArrayBuffer>> = function (
  opts = {},
) {
  this.compiler = (node) => {
    const builder = isBrowser()
      ? import("./builder/browser")
      : import("./builder/node");
    return mdastToPdf(node as Root, opts, builder);
  };
};
export default plugin;
