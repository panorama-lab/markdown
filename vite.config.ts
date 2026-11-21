import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { neverBundle: ["#math-image"] },
    entry: {
      "*": "./src/exports/*",
      "math-image.browser": "./src/renderer/math-image.browser.ts",
      "math-image.node": "./src/renderer/math-image.node.ts",
    },
    dts: {
      tsgo: true,
    },
    exports: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
