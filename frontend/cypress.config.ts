import { defineConfig } from "cypress";

export default defineConfig({
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
    specPattern: "src/**/*.cy.{js,jsx,cjs,mjs,ts,tsx}",
    excludeSpecPattern: "**/node_modules/**",
    viewportHeight: 660,
    viewportWidth: 1000
  },
  video: false,
});
