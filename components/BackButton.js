import Link from "next/link";
import styles from "./BackButton.module.css";

// Runde Glas-Pille oben links für Unterseiten (/overview, /admin) - sitzt
// exakt dort, wo auf dem Board das Hamburger-Menü sitzt (Chat-Wunsch:
// "propper backbuttons" statt kleinem Text-Link).
export default function BackButton({ href = "/", label = "Zurück" }) {
  return (
    <Link href={href} className={`${styles.button} glassChrome`} aria-label={label}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>
  );
}
