import { mergeConfig } from "vite";

/** @type { import('@storybook/react-vite').StorybookConfig } */
export default {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(js|jsx|ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      assetsInclude: ["**/*.md"],
    });
  },
};
