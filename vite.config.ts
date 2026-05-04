import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function copyManifestPlugin() {
  return {
    name: "copy-extension-manifest",
    closeBundle() {
      mkdirSync(dirname("dist/manifest.json"), { recursive: true });
      copyFileSync("extension/manifest.json", "dist/manifest.json");
    }
  };
}

export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "extension/src/popup/popup": "extension/src/popup/popup.html",
        content: "extension/src/content/index.ts",
        serviceWorker: "extension/src/background/serviceWorker.ts"
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
