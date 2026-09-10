import { defineConfig } from "vite";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(__dirname + "/package.json", "utf8"));

// The app lives in ./app; the bundle goes to ./dist for the Tauri shell.
export default defineConfig({
  root: "app",
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
