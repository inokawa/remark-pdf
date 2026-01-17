/**
 * @internal
 */
export type Writeable<T> = {
  -readonly [key in keyof T]: T[key];
};

const alreadyWarned: { [message: string]: boolean } = {};

/**
 * @internal
 */
export function warnOnce(message: string, cond: boolean = false): void {
  if (!cond && !alreadyWarned[message]) {
    alreadyWarned[message] = true;
    console.warn(message);
  }
}
