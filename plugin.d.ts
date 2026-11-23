import { Plugin } from 'unified';
import { PdfOptions } from './mdast-util-to-pdf';
import { Root } from 'mdast';
export type { PdfOptions };
declare const plugin: Plugin<[PdfOptions?], Root, Uint8Array>;
export default plugin;
