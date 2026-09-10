import { resolve } from "node:path";
import { defineConfig } from "vite";

const exampleRoot = resolve(import.meta.dirname, "examples/react");

export default defineConfig({
  root: exampleRoot,
  base: "/.artifacts/examples/react/",
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, ".artifacts/examples/react"),
    rollupOptions: {
      input: resolve(exampleRoot, "index.html"),
    },
  },
});
