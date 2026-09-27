"use client";

import { tableOrdinalFromLabel } from "@/lib/core/seating";
import styles from "./TableTabs.module.css";

// Chat-Redesign: "pills to fit in one row on mobile ... Tische: and next row
// just the numbers no expanding animation neded just visual change as is" -
// JEDER Tab zeigt nur die Ziffer, auch der aktive (vorher voller Name bei
// aktiv) - gleich breite Pillen passen so alle 8 in eine Zeile statt bei 8
// Tischen umzubrechen, und es gibt keinen Größenunterschied mehr zwischen
// aktiv/inaktiv, der animiert werden müsste (nur noch ein Farbwechsel).
export default function TableTabs({ tables, activeTableId, onSelect, glowTableIds = [] }) {
  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>Tische</span>
      <div className={styles.tabs}>
        {tables.map((table) => {
          const active = table._id === activeTableId;
          return (
            <button
              key={table._id}
              type="button"
              className={`${styles.tab} ${active ? styles.active : ""} ${
                glowTableIds.includes(table._id) ? "glow" : ""
              }`}
              style={
                active
                  ? { backgroundColor: table.color }
                  : { color: table.color }
              }
              onClick={() => onSelect(table._id)}
              aria-label={table.label}
              aria-current={active}
            >
              {tableOrdinalFromLabel(table.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
