import { Buffer } from "buffer";
// @ts-expect-error
import { default as pako } from "pako";

export default {
  deflateSync: (input: ArrayBuffer) => {
    return Buffer.from(pako.deflate(input));
  },
  inflate: (buffer: Buffer, cb: (error: Error | null, result: NonSharedBuffer) => void) => {
    try {
      const result = pako.inflate(buffer);
      cb(null, Buffer.from(result));
    } catch (err) {
      cb(err as Error, null!)
    }
  }
};
