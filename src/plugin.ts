import type { Plugin, Transformer } from "unified";
import { mdastToPdf, type PdfOptions } from "./mdast-util-to-pdf";

import type { Root } from "mdast";

export type { PdfOptions };

/**
 * @internal
 */
declare module "vfile" {
  interface DataMap {
    pdf: Uint8Array;
  }
}

const plugin: Plugin<[PdfOptions?], Root, Uint8Array> = function (opts) {
  this.compiler = (_, file) => {
    // unified compiler must be a synchronous function according to the spec.
    // However generating pdf is asynchronous for a few inevitable reasons.
    // - `pdfkit` emits the document as a stream
    // - resolving assets such as images is asynchronous
    // So we use it in an async transformer and pass the result to compiler by VFile.data for now.
    if (file.path) {
      // remark-cli keeps the input name (e.g. `input.md`) when writing output.
      file.extname = ".pdf";
    }
    return file.data.pdf!;
  };

  const transformer: Transformer<Root, Root> = async (node, file) => {
    file.data.pdf = await mdastToPdf(node as Root, opts);
    return node;
  };

  return transformer as any;
};
export default plugin;
