module.exports = {
  roots: ["<rootDir>/src"],
  transformIgnorePatterns: ["node_modules/(?!remark-parse)/"],
  setupFiles: ["jest-date-mock"],
};
