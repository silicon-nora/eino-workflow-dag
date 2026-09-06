import { resolve } from "node:path";
import { defineConfig } from "vite";

const exampleRoot = resolve(import.meta.dirname, "examples/react");

export default defineConfig({
  root: exampleRoot,
  base: "/examples/react-dist/",
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "examples/react-dist"),
    rollupOptions: {
      input: resolve(exampleRoot, "index.html"),
    },
  },
});
