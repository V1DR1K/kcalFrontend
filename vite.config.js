import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { execSync } from "child_process";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localHttps = env.VITE_DEV_HTTPS === "true";
  let gitHash = "unknown";
  let buildTime = new Date().toISOString();
  try {
    gitHash = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}
  return {
  define: {
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_HASH__: JSON.stringify(gitHash),
  },
  plugins: [localHttps ? basicSsl() : null, react()].filter(Boolean),
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy: {
      "/api": {
        target: "http://localhost:8081",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  };
});
