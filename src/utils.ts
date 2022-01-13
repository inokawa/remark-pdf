export const error = (message: string) => {
  throw new Error(message);
};

export const isBrowser = () => {
  try {
    return this === window;
  } catch (e) {
    return false;
  }
};
