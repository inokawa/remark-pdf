/** @type { import('@storybook/react-webpack5').StorybookConfig } */
export default {
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
