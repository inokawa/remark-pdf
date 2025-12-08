/**
 * @internal
 */
export const error = (message: string): never => {
  throw new Error(message);
};

/**
 * @internal
 */
export const isBrowser = () => {
  try {
    return typeof window !== "undefined";
  } catch (e) {
    return false;
  }
};

export function deepMerge<T extends object>(
  target: T,
  source: Partial<T> | undefined
): T {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key] as object, source[key]));
    }
  }
  return { ...target, ...source };
}

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
