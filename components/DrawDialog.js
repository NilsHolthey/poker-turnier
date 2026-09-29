"use client";

import styles from "./DrawDialog.module.css";
import { shortName } from "@/lib/client/formatName";

// Auslosung: UX-Ablauf (spec) - Rolling-Animation (~1.3s) mit Würfel-Icon, danach
// eine persistierende Bestätigungs-Karte (kein Auto-Dismiss). Jede Umsetzung
// braucht manuelle Bestätigung.
//
// Die Rolling-Phase zeigt bewusst keine Kandidaten-Werte mehr (frühere Version
// zeigte für "balance" die Spielernummern des Quelltisches durch) - Quell- und
// Zieltisch stehen zu dem Zeitpunkt schon fest (Tischauswahl ist
// größenbasiert/deterministisch, nur bei Gleichstand zufällig), nur der Zug
// selbst (Spieler bei "balance", Zieltisch bei "dissolve") ist der eigentliche
// Zufallsteil. Kandidaten aus nur einem Tisch durchlaufen zu lassen suggerierte
// fälschlich, als sei nur dieser eine Tisch Teil der Auslosung.
export default function DrawDialog({
  phase,
  playerNum,
  playerName,
  playerIsBank,
  isDissolve,
  fromLabel,
  fromColor,
  toLabel,
  toColor,
  noAlternative,
  // Chat-Wunsch "Einfacher Modus": "operators should not accept and reroll,
  // this could get abused" - kein disabled-Button, sondern ganz weg, damit
  // erst gar keine Erwartung entsteht, hier wäre doch eine Wahl möglich.
  hideReroll,
  onConfirm,
  onReroll,
  busy,
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        {/* Chat-Wunsch: "Tisch wird aufgelöst" - damit klar ist, WARUM gerade
            ausgelost wird (kein normaler Ausgleich). */}
        {isDissolve && <span className={styles.dissolveBanner}>{fromLabel} wird aufgelöst</span>}
        {phase === "rolling" ? (
          <div className={styles.rolling}>
            <span className={styles.dice}>🎲</span>
            <span className={styles.rollingValue}>Wird ausgelost…</span>
          </div>
        ) : (
          <>
            <div className={styles.playerBlock}>
              <span className={styles.playerNum}>{playerNum}</span>
              <span className={styles.playerName}>
                {shortName(playerName)}
                {playerIsBank && <span className={styles.bankTag} aria-label="Bank">
                  <span className={styles.bankWord}>Bank</span> $
                </span>}
              </span>
            </div>

            <div className={styles.route}>
              <span className={styles.tableChip} style={{ borderColor: fromColor }}>
                {fromLabel}
              </span>
              <span className={styles.arrow}>→</span>
              {noAlternative ? (
                <span className={styles.noAlternative}>keine Alternative</span>
              ) : (
                <span className={styles.tableChip} style={{ borderColor: toColor }}>
                  {toLabel}
                </span>
              )}
            </div>

            <div className={styles.actions}>
              {!hideReroll && (
                <button
                  type="button"
                  className={styles.rerollButton}
                  onClick={onReroll}
                  disabled={busy || noAlternative}
                >
                  Neu auslosen
                </button>
              )}
              <button type="button" className={styles.confirmButton} onClick={onConfirm} disabled={busy}>
                Bestätigen
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
