import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: "create-react-app",
      bundler: "webpack",
    },
    viewportHeight: 660,
    viewportWidth: 1000
  },
  video: false,
  },
);
