"use client";

import { useEffect, useState } from "react";
import styles from "./Sheet.module.css";

// Gemeinsame Hülle für die oben hängenden Sheets (Tisch verwalten,
// Blindstruktur): Glas-Karte mit Titel + Schließen-Pille und Ein-/Ausblend-
// Animation (Chat-Wunsch: "needs some transition"). Schließen läuft immer über
// requestClose, damit erst die Ausblend-Animation spielt und danach onClose.
export default function Sheet({ title, subtitle, accentColor, onClose, children }) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && setClosing(true);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className={`${styles.overlay} ${closing ? styles.overlayClosing : ""}`}
      onClick={() => setClosing(true)}
      // Nur die Overlay-eigene Animation zählt - animationend bubbelt sonst
      // auch von Kindern (Sheet, Buttons) hoch.
      onAnimationEnd={(e) => closing && e.target === e.currentTarget && onClose()}
    >
      <div
        className={`${styles.sheet} ${closing ? styles.sheetClosing : ""}`}
        style={accentColor ? { "--sheet-accent": accentColor } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h3 className={styles.title}>{title}</h3>
            {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
          </div>
          <button type="button" className={`${styles.close} glassChrome`} onClick={() => setClosing(true)} aria-label="Schließen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
