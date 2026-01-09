import type { PdfBuilder } from "../mdast-util-to-pdf";

import * as pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
(pdfMake as any).addVirtualFileSystem(pdfFonts);

const builder: PdfBuilder = (def) => {
  const pdf = pdfMake.createPdf(def);

  return new Promise((resolve) => {
    pdf.getBuffer((b) => resolve(new Uint8Array(b)));
  });
};

export default builder;
