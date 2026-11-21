// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  plugins: [VitePWA({
    strategies: "generateSW",
    outDir: "dist/client",
    filename: "sw.js",
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    manifest: false,
    workbox: {
      globDirectory: "dist/client",
      globPatterns: ["**/*.{js,mjs,css,woff,woff2,png,ico,wasm}"],
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      navigateFallback: null,
      navigateFallbackDenylist: [/^\/~oauth/],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ request, url }) => url.origin === self.location.origin && !url.pathname.startsWith("/~oauth") && (request.mode === "navigate" || (request.headers.get("Accept")?.includes("text/html") === true && ["/", "/editor", "/pages", "/formats", "/offline", "/architecture"].includes(url.pathname))),
          handler: "NetworkFirst",
          options: { cacheName: "anyconvert-pages", networkTimeoutSeconds: 3, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url }) => url.origin === self.location.origin && /^\/assets\/.+-[a-zA-Z0-9_-]{8,}\.(js|mjs|css|woff2?|png|wasm)$/.test(url.pathname),
          handler: "CacheFirst",
          options: { cacheName: "anyconvert-assets", cacheableResponse: { statuses: [200] } },
        },
      ],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
