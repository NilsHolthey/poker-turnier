"use client";

import { tableOrdinalFromLabel } from "@/lib/core/seating";
import styles from "./MyTableChips.module.css";

// "Mein Tisch" ist fest an den Login-Account gebunden (ein Operator-Account pro
// Tisch, spec "Rollenmodell"). Teil der BottomNav (Chat: "dein tisch in the
// bottom nav"). Optik wie die Tisch-Pillen: gefülltes Squircle mit der Ziffer
// in Tischfarbe, daneben "Dein Tisch" über dem Tischnamen (Chat: "not happy
// with the dein tisch button"). Ganzer Chip ist der Tap-Target - in der
// Tische-Ansicht springt er auf den Tab, in der Liste klappt er die Karte auf.
export default function MyTableChips({ table, onSelect }) {
  if (!table) return null;

  return (
    <button type="button" className={styles.chip} onClick={onSelect} aria-label={`Dein Tisch: ${table.label}`}>
      <span className={styles.badge} style={{ backgroundColor: table.color }}>
        {tableOrdinalFromLabel(table.label)}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>Dein Tisch</span>
        <span className={styles.name} style={{ color: table.color }}>
          {table.label}
        </span>
      </span>
    </button>
  );
}
