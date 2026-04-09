import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function createProxyTarget(target) {
  return {
    target,
    changeOrigin: true,
    secure: !target.startsWith("https://") ? undefined : false,
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:5000";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/auth": createProxyTarget(apiProxyTarget),
        "/admin": createProxyTarget(apiProxyTarget),
        "/posts": createProxyTarget(apiProxyTarget),
        "/uploads": createProxyTarget(apiProxyTarget),
      },
    },
  };
});
