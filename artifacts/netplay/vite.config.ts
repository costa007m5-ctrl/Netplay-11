import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const isReplit = !!process.env.REPL_ID;
const isProduction = process.env.NODE_ENV === "production";

const rawPort = process.env.PORT;
// Usa a PORT injetada pelo Replit (ex: 25512) — o proxy do Replit roteia para essa porta
const port = rawPort ? parseInt(rawPort, 10) : 5000;
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
      dedupe: ["react", "react-dom", "framer-motion", "motion"],
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
      // Minificação esbuild com remoção de código morto e comentários
      minify: "esbuild",
      rollupOptions: {
        output: {
          // Melhor compressão de nomes de variáveis internas
          generatedCode: {
            constBindings: true,
          },
          manualChunks(id: string) {
            if (id.includes("node_modules")) {
              if (id.includes("hls.js")) return "vendor-hls";
              if (id.includes("react-dom")) return "vendor-react-dom";
              if (id.includes("react-router")) return "vendor-router";
              if (id.includes("framer-motion") || id.includes("motion/react") || id.includes("motion")) return "vendor-motion";
              if (id.includes("lucide-react")) return "vendor-lucide";
              if (id.includes("@radix-ui")) return "vendor-radix";
              if (id.includes("@supabase")) return "vendor-supabase";
              if (id.includes("@tanstack")) return "vendor-query";
              if (id.includes("socket.io") || id.includes("engine.io")) return "vendor-socket";
              if (id.includes("axios")) return "vendor-axios";
            }
            return undefined;
          },
        },
      },
    },
    // esbuild options: remove console.log em prod, legalComments none para reduzir bundle
    esbuild: {
      legalComments: "none",
      ...(isProduction ? { drop: ["console", "debugger"] } : {}),
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "react/jsx-runtime",
        "axios",
        "@tanstack/react-query",
      ],
      exclude: ["framer-motion", "motion", "motion/react"],
    },
    server: {
      port,
      strictPort: !!rawPort,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: false,
      },
      // Aumenta limite de conexões simultâneas para dev
      hmr: {
        overlay: true,
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
