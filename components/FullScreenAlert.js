"use client";

import styles from "./FullScreenAlert.module.css";

// Vollflächiger, deutlich sichtbarer Alert bei jeder tatsächlichen Umsetzung, on
// top vom Randglühen an Quell-/Zieltisch (spec, "Umsetzungs-Signal").
// pointer-events: none - blockiert die Bedienung nicht.
export default function FullScreenAlert({ text }) {
  return (
    <div className={styles.overlay} aria-live="polite">
      <div className={styles.banner}>{text}</div>
    </div>
  );
}
