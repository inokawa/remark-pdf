// Declarations added in pdfkit 0.20 that @types/pdfkit doesn't cover yet.
declare module "pdfkit/standard-fonts/*" {
  const font: object;
  export default font;
}

declare module "pdfkit/output" {
  export function toBytes(
    doc: PDFKit.PDFDocument,
  ): Promise<Uint8Array<ArrayBuffer>>;
}

declare namespace PDFKit {
  interface PDFOutline {
    addItem(
      title: string,
      options?: {
        expanded?: boolean;
        fit?: boolean;
        top?: number;
        left?: number;
      },
    ): PDFOutline;
  }
}
