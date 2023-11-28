/**
 * @internal
 */
export const error = (message: string) => {
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
