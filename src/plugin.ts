import type { Plugin, Transformer } from "unified";
import { mdastToPdf, type PdfOptions } from "./mdast-util-to-pdf";

import type { Root } from "mdast";
import { isBrowser } from "./utils";

export type { PdfOptions };

/**
 * @internal
 */
declare module "vfile" {
  interface DataMap {
    pdf: Uint8Array;
  }
}

const plugin: Plugin<[PdfOptions?], Root, Uint8Array> = function (opts = {}) {
  this.compiler = (_, file) => {
    return file.data.pdf!;
  };

  const transformer: Transformer<Root, Root> = async (node, file) => {
    const builder = isBrowser()
      ? import("./builder/browser")
      : import("./builder/node");
    const result = await mdastToPdf(node as Root, opts, builder);
    file.data.pdf = result;
    return node;
  };

  return transformer as any;
};

export default plugin;
