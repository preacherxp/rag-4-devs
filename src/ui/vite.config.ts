import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 4137,
    proxy: {
      "/api": {
        target: `http://localhost:${process.env.PORT || 4138}`,
        changeOrigin: true,
      },
    },
  },
});
