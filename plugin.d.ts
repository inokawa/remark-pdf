import { Plugin } from 'unified';
import { PdfOptions } from './mdast-util-to-pdf';
import { Root } from 'mdast';
export type { PdfOptions };
declare module "unified" {
    interface CompileResultMap {
        pdf: Promise<ArrayBuffer>;
    }
}
declare const plugin: Plugin<[PdfOptions?], Root, Promise<ArrayBuffer>>;
export default plugin;
