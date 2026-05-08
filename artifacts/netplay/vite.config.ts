import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit = !!process.env.REPL_ID;
const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;
const port = rawPort ? Number(rawPort) : 5173;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async () => {
  const replitPlugins =
    isReplit && !isProduction
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : [];

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("hls.js")) return "vendor-hls";
            if (id.includes("firebase")) return "vendor-firebase";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("framer-motion") || id.includes("/motion/")) return "vendor-motion";
            if (id.includes("lucide-react") || id.includes("react-icons")) return "vendor-icons";
            if (id.includes("@radix-ui")) return "vendor-radix";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("react-dom") || id.includes("react-router") || id.includes("/react/")) return "vendor-react";
            return "vendor";
          },
        },
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "motion/react"],
    },
    server: {
      port,
      strictPort: !!rawPort,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: false,
      },
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
