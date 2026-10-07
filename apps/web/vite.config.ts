import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";

function versionManifest(version: string): Plugin {
  const source = JSON.stringify({ version });
  return {
    name: "vita-version-manifest",
    configureServer(server) {
      server.middlewares.use("/version.json", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source });
    },
  };
}

export default defineConfig(({ mode }) => {
  const version = loadEnv(mode, process.cwd()).VITE_APP_VERSION?.trim() ?? "";
  return {
    plugins: [
      versionManifest(version),
      // No route-file plugin: the product's routes are code-based and come from
      // `@vita-os/application`, and this host defines its own beside them.
      react(),
      cloudflare(),
      babel({
        presets: [reactCompilerPreset()],
      }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": "/src",
      },
    },
    test: {
      passWithNoTests: true,
      projects: [
        {
          extends: true,
          test: {
            name: "web",
            include: ["src/**/*.test.{ts,tsx}"],
            globals: true,
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            css: true,
          },
        },
      ],
    },
    server: {
      hmr:
        process.env.VITA_VERIFY_DISABLE_HMR === "1"
          ? { clientPort: 1 }
          : undefined,
    },
    preview: {
      port: 5173,
    },
  };
});
