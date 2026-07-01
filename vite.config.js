import { defineConfig } from "vite";

// Minimal config for the split phase. Plugins (Elm/Gleam/TS) added later.
export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
