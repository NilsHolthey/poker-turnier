"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/lib/client/useMounted";
import { formatBlindLevel, computeEffectiveBlindState } from "@/lib/core";
import styles from "./BlindPill.module.css";

function formatRemaining(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const AUTO_COLLAPSE_MS = 6000;

// Eigenständige, oben zentrierte Pille wie die Dynamic Island/der Notch am
// iPhone (Chat-Redesign: "blines shoul live centered top now ... pill should
// be increasing in size onclick ... very dark baground color also like notch
// on iphone") - NICHT mehr Teil der BottomNav, eigenes fixed Element auf
// Höhe von Hamburger-Menü/Verwalten-Icon. Derselbe <div> bleibt beim
// Auf-/Zuklappen erhalten (kein Element-Typ-Wechsel), nur width/height/
// border-radius transitionieren - das erzeugt den "wächst an Ort und Stelle"-
// Effekt statt eines woanders auftauchenden Dropdowns. Tickt lokal jede
// Sekunde weiter (computeEffectiveBlindState ist eine reine Funktion, kein
// Server-Roundtrip nötig).
export default function BlindPill({ schedule, isAdmin, onAdvance, onStart, onEdit, busy }) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useMounted();

  useEffect(() => {
    if (!schedule) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [schedule]);

  // Schließt die aufgeklappte Pille von selbst statt nur per erneutem Tap
  // (Chat-Wunsch: "should auto shrink after a while and on scroll not just on
  // click") - Timeout fürs "nicht mehr angefasst", Scroll-Listener fürs
  // Wegscrollen (Seite scrollt auf body/html-Ebene, kein eigener
  // Scroll-Container, siehe app/globals.css).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(false), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [open]);

  if (!schedule) {
    if (!isAdmin) return null;
    return (
      <div className={styles.wrapper}>
        <button type="button" className={styles.setupChip} onClick={onEdit}>
          Blinds festlegen
        </button>
      </div>
    );
  }

  const { effectiveIndex, remainingMs, level, started } = computeEffectiveBlindState(schedule, now);
  const nextLevel = schedule.levels[effectiveIndex + 1] ?? null;

  return (
    <div className={styles.wrapper}>
      {/* Portal statt normalem Kind (Chat-Bugreport-Klasse: siehe Toast.js) -
          .wrapper hat ein eigenes transform (translateX für die Zentrierung),
          das würde ein normal verschachteltes position:fixed-Backdrop nur
          relativ zur winzigen Pille statt zum echten Viewport positionieren -
          "Tap außerhalb schließt" wäre dann kaputt, ohne dass es auffällt. */}
      {open &&
        mounted &&
        createPortal(
          <button type="button" className={styles.backdrop} aria-label="Schließen" onClick={() => setOpen(false)} />,
          document.body
        )}
      <div
        className={`${styles.pill} ${open ? styles.expanded : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
        aria-label={
          open
            ? "Blindstruktur, antippen zum Schließen"
            : started
              ? `Blinds ${formatBlindLevel(level)}, antippen für Details`
              : "Blinds noch nicht gestartet, antippen für Details"
        }
      >
        {open ? (
          <div className={styles.content}>
            <span className={styles.value}>{formatBlindLevel(level)}</span>
            {started ? (
              <>
                <span className={styles.timer}>{formatRemaining(remainingMs)} verbleibend</span>
                <div className={styles.nextRow}>
                  <span className={styles.nextLabel}>Nächstes</span>
                  <span className={styles.nextValue}>{nextLevel ? formatBlindLevel(nextLevel) : "Ende"}</span>
                </div>
              </>
            ) : (
              <span className={styles.timer}>Noch nicht gestartet</span>
            )}
            {isAdmin && (
              <div className={styles.adminControls}>
                {started ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdvance(effectiveIndex - 1);
                      }}
                      disabled={busy || effectiveIndex <= 0}
                      aria-label="Vorheriges Level"
                    >
                      ◂
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdvance(effectiveIndex + 1);
                      }}
                      disabled={busy || effectiveIndex >= schedule.levels.length - 1}
                      aria-label="Nächstes Level"
                    >
                      ▸
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.startButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStart();
                    }}
                    disabled={busy}
                    aria-label="Blind-Uhr starten"
                  >
                    ▶
                  </button>
                )}
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  aria-label="Blindstruktur bearbeiten"
                >
                  ✎
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className={styles.collapsedValue}>
            {formatBlindLevel(level)}
            {!started && <span className={styles.notStartedDot} aria-hidden="true" />}
          </span>
        )}
      </div>
    </div>
  );
}
