// Natives Next.js App-Router-Manifest statt next-pwa (siehe
// node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md) - deckt
// den Manifest-Teil des ursprünglich vorgegebenen next-pwa-Stacks bereits ohne
// den Turbopack-riskanten Drittanbieter-Webpack-Plugin ab.
export default function manifest() {
  return {
    name: "Poker-Turnier Tisch-Management",
    short_name: "Poker-Turnier",
    description: "Live-Tisch-Management für das Freundes-Pokerturnier",
    start_url: "/",
    display: "standalone",
    background_color: "#03110d",
    theme_color: "#16302b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
