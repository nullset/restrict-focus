import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "restrictFocus",
      fileName: "restrict-focus",
      formats: ["es", "umd"],
    },
    rollupOptions: {
      // external: [], // specify external dependencies here if any
      output: {
        // Provide globals for UMD build if you have external dependencies
        globals: {
          // 'some-dependency': 'SomeDependency'
        },
      },
    },
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  server: {
    open: "/index.html", // Automatically open demo page
  },
});
