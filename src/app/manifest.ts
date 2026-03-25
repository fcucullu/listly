import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PatternFinder",
    short_name: "PatternFinder",
    description: "Track recurring events and spot patterns",
    start_url: "/track",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#06B6D4",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
