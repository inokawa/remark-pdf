module.exports = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: ["@storybook/addon-storysource"],
  framework: {
    name: "@storybook/react-webpack5",
    options: {},
  },
};
