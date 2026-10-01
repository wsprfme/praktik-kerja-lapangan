import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Update ditangani UI sendiri (PwaUpdatePrompt) agar murid sadar ada versi baru.
      registerType: "prompt",
      includeAssets: ["apple-touch-icon.png", "maskable-512.png"],
      manifest: {
        name: "Portal Manajemen PKL",
        short_name: "PKL",
        description:
          "Sistem Informasi Praktik Kerja Lapangan — presensi, jurnal harian, pengajuan izin, dan nilai.",
        lang: "id",
        dir: "ltr",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#171717",
        background_color: "#ffffff",
        categories: ["education"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Presensi",
            url: "/siswa/presensi",
            icons: [{ src: "icon-192.png", sizes: "192x192" }],
          },
          {
            name: "Jurnal Harian",
            url: "/siswa/jurnal",
            icons: [{ src: "icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        // SPA: navigasi non-API disajikan dari index.html yang sudah di-precache.
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            // Data API, geocoding Mapbox, dan Nominatim: SELALU network.
            // Mapbox temporary (permanent=false) wajib tidak di-cache (lisensi).
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api") ||
              url.hostname === "api.mapbox.com" ||
              url.hostname === "nominatim.openstreetmap.org",
            handler: "NetworkOnly",
          },
          {
            // Logo sekolah statis: boleh di-cache lama.
            urlPattern: ({ url }) => url.hostname === "cdn-image.jolink.co.id",
            handler: "CacheFirst",
            options: {
              cacheName: "static-images",
              expiration: { maxEntries: 20, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Backend SQLite di server/index.js (PORT default 3101).
      // Frontend memanggil via VITE_API_URL; proxy ini untuk dev agar same-origin /api works.
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3101",
        changeOrigin: true,
      },
    },
  },
})
