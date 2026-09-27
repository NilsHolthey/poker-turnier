/** @type {import('next').NextConfig} */
const nextConfig = {
  // Auth0 v4 hängt seine Routen unter /auth/* ein - ein direkt getipptes/
  // gebookmarktes /login liefe sonst in ein 404.
  async redirects() {
    return [{ source: "/login", destination: "/auth/login", permanent: false }];
  },
  // sw.js darf nie stale ausgeliefert werden (Push-Handler-Updates müssen sofort
  // ankommen), siehe progressive-web-apps.md "Securing your application".
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
