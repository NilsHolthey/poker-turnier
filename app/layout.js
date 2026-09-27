import { Bebas_Neue, DM_Sans } from "next/font/google";
import "./globals.css";

// "dark glass dashboard" Design-System (Chat): Bebas Neue für große Zahlen/
// Titel (--font-display), DM Sans für Fließtext (--font-body, ersetzt den
// bisherigen System-Font-Stack als primäre Schrift in app/globals.css).
// next/font/google statt <link>-Import: hostet die Dateien selbst zur
// Build-Zeit mit, kein Laufzeit-Request an Google, kein FOUT.
const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "Poker-Turnier Tisch-Management",
  description: "Live-Tisch-Management für das Freundes-Pokerturnier",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Poker-Turnier",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#16302b",
  // Lässt den Inhalt bis unter Notch/Dynamic Island/Status-Leiste/Home-Indicator
  // zeichnen (nötig, damit appleWebApp.statusBarStyle "black-translucent" oben
  // überhaupt etwas bewirkt) - erst dadurch liefert env(safe-area-inset-*) in
  // den Komponenten unten echte Werte statt immer 0 (spec-Erweiterung, siehe
  // Chat: "Design für Notch auf iPhone/Pixel etc. reconsiderieren").
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de" className={`${bebasNeue.variable} ${dmSans.variable}`}>
      <body>
        {/* Nur unten (siehe app/globals.css .fadeBottom-Kommentar) - die
            BottomNav-Pille (inkl. Blindanzeige, BlindBanner ist retired)
            bleibt dort fixed, dafür bleibt der Fade dort sinnvoll. */}
        <div className="fadeBottom" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
