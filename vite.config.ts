import { defineConfig } from "vite";

// The app lives in ./app; the bundle goes to ./dist for the Tauri shell.
export default defineConfig({
  root: "app",
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { outDir: "../dist", emptyOutDir: true, target: "es2022" },
});
