import { RemarkPdfPlugin } from '../../mdast-util-to-pdf';
/**
 * A plugin to render LaTeX inside "math" and "inlineMath" nodes with
 * [MathJax](https://www.mathjax.org/), as SVG.
 */
export declare const latexPlugin: () => RemarkPdfPlugin;
