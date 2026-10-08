import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Ledgero 家庭記帳與資產管理",
    short_name: "Ledgero",
    description: "一起管理家庭收支與資產。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FBF9F5",
    theme_color: "#B8976C",
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}