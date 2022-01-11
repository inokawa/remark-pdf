import type { Plugin } from "unified";
import * as mdast from "mdast";
import { visit } from "unist-util-visit";
import { mdastToPdf, Opts, ImageDataMap } from "./transformer";

export type Options = Opts;

const plugin: Plugin<[Options?]> = function (opts = {}) {
  let images: ImageDataMap = {};

  this.Compiler = (node) => {
    return mdastToPdf(node as any, opts, images);
  };
};
export default plugin;
