export type ToPngFn = (options: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
}) => Promise<ArrayBuffer | Uint8Array>;
/**
 * Converts images to PNG with canvas. Works only on browser.
 */
export declare const browserToPng: ({ buffer, width, height }: {
    buffer: ArrayBuffer;
    width: number;
    height: number;
}) => Promise<ArrayBuffer>;
