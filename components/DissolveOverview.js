"use client";

import drawStyles from "./DrawDialog.module.css";
import styles from "./DissolveOverview.module.css";
import { shortName } from "@/lib/client/formatName";

// Sammel-Übersicht nach einer Tisch-Auflösung (Chat-Wunsch: "Tisch wird
// aufgelöst ... show both players' new seating in one popup as overview") -
// die einzelnen Auslosungen laufen weiterhin nacheinander, danach zeigt EIN
// Popup, wer wohin umgesetzt wurde und welchen neuen Platz er hat.
export default function DissolveOverview({ tableLabel, moves, onClose }) {
  return (
    <div className={drawStyles.overlay} role="dialog" aria-modal="true">
      <div className={drawStyles.card}>
        <div className={styles.header}>
          <span className={styles.title}>{tableLabel} wurde aufgelöst</span>
          <span className={styles.subtitle}>Neue Sitzplätze</span>
        </div>

        <ul className={styles.list}>
          {moves.map((move, i) => (
            <li key={i} className={styles.row}>
              <span className={styles.who}>
                {shortName(move.name)}
                {move.isBank && <span className={drawStyles.bankTag} aria-label="Bank">
                    <span className={drawStyles.bankWord}>Bank</span> $
                  </span>}
              </span>
              <span className={styles.route}>
                <span className={styles.seat}>{move.fromNum}</span>
                <span className={drawStyles.arrow}>→</span>
                <span className={styles.seat} style={{ color: move.toColor }}>
                  {move.newNum ?? "?"}
                </span>
                <span className={styles.tableName}>{move.toLabel}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className={drawStyles.actions}>
          <button type="button" className={drawStyles.confirmButton} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
