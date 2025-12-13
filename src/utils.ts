/**
 * @internal
 */
export const error = (message: string): never => {
  throw new Error(message);
};

/**
 * @internal
 */
export const isEqualObject = <T extends object>(a: T, b: T): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!(k in b)) {
      return false;
    }
    if ((a as any)[k] !== (b as any)[k]) {
      return false;
    }
  }
  return true;
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
