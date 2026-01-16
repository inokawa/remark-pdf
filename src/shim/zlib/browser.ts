import { Buffer } from "buffer";
// @ts-expect-error
import { default as pako } from "pako";

export default {
  deflateSync: (input: ArrayBuffer) => {
    return Buffer.from(pako.deflate(input));
  },
};
