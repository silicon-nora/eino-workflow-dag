import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isESM = mode === "es";
  const isCJS = mode === "cjs";
  const isModuleBuild = isESM || isCJS;
  const entries = isModuleBuild
    ? {
        index: resolve(import.meta.dirname, "src/index.js"),
        cytoscape: resolve(import.meta.dirname, "src/cytoscape.js"),
        validation: resolve(import.meta.dirname, "src/validation.js"),
        vue: resolve(import.meta.dirname, "src/vue.js"),
        react: resolve(import.meta.dirname, "src/react.js"),
      }
    : resolve(import.meta.dirname, "src/index.js");

  return {
    build: {
      emptyOutDir: isESM,
      lib: {
        entry: entries,
        name: "EinoWorkflowDAG",
        formats: [isESM ? "es" : isCJS ? "cjs" : "umd"],
        fileName: (format, entryName) => {
          if (format === "umd") return "eino-workflow-dag.umd.js";
          if (format === "cjs") {
            return entryName === "index"
              ? "eino-workflow-dag.cjs"
              : `${entryName}.cjs`;
          }
          return entryName === "index" ? "eino-workflow-dag.js" : `${entryName}.js`;
        },
        cssFileName: "eino-workflow-dag",
      },
      rollupOptions: {
        external: isModuleBuild ? ["cytoscape", "react", "vue"] : [],
        output: { exports: "named" },
      },
      // The repository is the canonical source. Generated source maps are
      // omitted to keep the install artifact below 350 KiB.
      sourcemap: false,
    },
  };
});
