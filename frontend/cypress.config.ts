import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: "create-react-app",
      bundler: "webpack",
    },
    specPattern: "src/**/*.cy.{js,jsx,ts,tsx}",
    excludeSpecPattern: "**/node_modules/**",
    viewportHeight: 660,
    viewportWidth: 1000
  },
  video: false,
});
