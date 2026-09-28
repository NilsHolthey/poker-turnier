"use client";

import { useEffect, useState } from "react";
import BackButton from "./BackButton";
import { formatBlindLevel, computeEffectiveBlindState } from "@/lib/core";
import styles from "./OverviewBoard.module.css";

function formatRemaining(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Volle Blindstruktur inkl. Dauer/Pausen + Spieler übrig auf einer eigenen
// Seite (Chat-Wunsch, erreichbar über das Hamburger-Menü) - tickt wie
// BlindPill lokal jede Sekunde weiter, damit die aktuelle Zeile live markiert
// bleibt, ohne auf den nächsten Seiten-Reload zu warten.
export default function OverviewBoard({ tournamentName, schedule, playerCount }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!schedule) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [schedule]);

  const effective = schedule ? computeEffectiveBlindState(schedule, now) : null;

  return (
    <main className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>{tournamentName}</h1>
      </div>

      <div className={styles.statCard}>
        <span className={styles.statValue}>{playerCount}</span>
        <span className={styles.statLabel}>Spieler übrig</span>
      </div>

      {!schedule ? (
        <p className={styles.empty}>Noch keine Blindstruktur hinterlegt.</p>
      ) : (
        <div className={styles.tableCard}>
          <div className={`${styles.row} ${styles.rowHead}`}>
            <span>Level</span>
            <span>Blinds</span>
            <span>Dauer</span>
          </div>
          {schedule.levels.map((level, i) => {
            const isCurrent = i === effective.effectiveIndex;
            return (
              <div key={i} className={`${styles.row} ${isCurrent ? styles.rowCurrent : ""}`}>
                <span className={styles.rowIndex}>{i + 1}</span>
                <span className={styles.rowValue}>
                  {formatBlindLevel(level)}
                  {isCurrent && <span className={styles.remaining}>{formatRemaining(effective.remainingMs)}</span>}
                </span>
                <span className={styles.rowDuration}>{level.durationMinutes} min</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
