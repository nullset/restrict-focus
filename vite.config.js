const path = require("path");

/**
 * @type {import('vite').UserConfig}
 */
const config = {
  // ...
  build: {
    target: "es2017",
    lib: {
      entry: path.resolve(__dirname, "./src/index.js"),
      name: "RestrictFocus",
      fileName: (format) => `restrict-focus.${format}.js`,
      output: {
        exports: "named",
      },
    },
    rollupOptions: {
      output: {
        exports: "named",
      },
    },
  },
};

export default config;
