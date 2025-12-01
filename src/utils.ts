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

export function deepMerge(target: any, source: any): any {
  for (const key in source) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  return { ...target, ...source };
}