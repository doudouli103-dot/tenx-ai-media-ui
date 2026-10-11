import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.TENX_MEDIA_PROXY_TARGET || "http://windows.tentest.cn:8092";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/media-api": {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media-api/, ""),
        },
      },
    },
  };
});

