import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { DEFAULT_API_BASE_URL, withApiHostPermission, type ExtensionManifest } from "./build/manifestConfig";

function copyManifestPlugin(apiBaseUrl: string) {
  return {
    name: "copy-extension-manifest",
    closeBundle() {
      mkdirSync(dirname("dist/manifest.json"), { recursive: true });
      const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as ExtensionManifest;
      const nextManifest = withApiHostPermission(manifest, apiBaseUrl);
      writeFileSync("dist/manifest.json", `${JSON.stringify(nextManifest, null, 2)}\n`);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;

  return {
    plugins: [react(), copyManifestPlugin(apiBaseUrl)],
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
  };
});
