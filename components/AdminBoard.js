"use client";

import { useState } from "react";
import BackButton from "./BackButton";
import TournamentSetupForm from "./TournamentSetupForm";
import BlindScheduleSheet from "./BlindScheduleSheet";
import ConfirmDialog from "./ConfirmDialog";
import PushToggle from "./PushToggle";
import TournamentEditForm from "./TournamentEditForm";
import { deleteTournament, startBlindClock, resetBlindClock } from "@/lib/client/api";
import { formatBlindLevel, computeEffectiveBlindState } from "@/lib/core";
import styles from "./AdminBoard.module.css";

// Admin-exklusive Seite (Chat-Wunsch: "the new admin site") - fasst zusammen,
// was vorher zwei Hamburger-Menüpunkte waren (Neues Turnier, Blindstruktur
// bearbeiten), jetzt als eigene Kacheln auf einer eigenen Seite statt als
// Modals über dem Live-Board. TournamentSetupForm/BlindScheduleSheet werden
// unverändert wiederverwendet, nur der Einstiegspunkt ist neu.
export default function AdminBoard({ tournamentId, tournamentName, schedule, settings }) {
  const [showBlindSchedule, setShowBlindSchedule] = useState(false);
  const [showNewTournament, setShowNewTournament] = useState(!tournamentId);
  const [confirmReset, setConfirmReset] = useState(false);
  const [clockBusy, setClockBusy] = useState(false);
  const [clockError, setClockError] = useState(null);
  const clockStarted = schedule ? computeEffectiveBlindState(schedule).started : false;
  const [showEdit, setShowEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // "Turnier starten" startet die Blind-Uhr des bestehenden Turniers (Chat-Fix:
  // der Button öffnete vorher nur wieder das Anlege-Formular) - ein neues
  // Turnier anzulegen ist jetzt eine eigene, sekundäre Aktion.
  async function runClockAction(fn) {
    setClockBusy(true);
    setClockError(null);
    try {
      await fn(tournamentId);
      window.location.reload();
    } catch (err) {
      setClockError(err.message);
      setClockBusy(false);
      setConfirmReset(false);
    }
  }

  async function handleDeleteTournament() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteTournament(tournamentId);
      window.location.reload();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <main className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>Admin-Bereich</h1>
        {/* Chat-Wunsch: "missing notifications bell on admin" - admin bekommt
            jetzt bei jedem Zug an jedem Tisch eine Push-Benachrichtigung (siehe
            notifyAdmin in lib/server/push.js), Toggle direkt hier statt nur
            auf dem Haupt-Board erreichbar. */}
        <div className={styles.notifyRow}>
          <PushToggle />
        </div>
      </div>

      {/* Primäre Aktion zuerst und deutlich prominenter (Chat-Wunsch: "admin
          needs a start tournament button") - vorher zweite Karte mit
          derselben schwachen Outline-Optik wie "Blindstruktur bearbeiten". */}
      <section className={`${styles.card} ${styles.primaryCard}`}>
        <h2 className={styles.cardTitle}>Turnier</h2>
        {tournamentId && (
          <div className={styles.statusRow}>
            <span className={`${styles.statusDot} ${clockStarted ? styles.statusDotOn : ""}`} aria-hidden="true" />
            <span className={styles.statusText}>
              <strong>{tournamentName}</strong>
              <span className={styles.hint}>{clockStarted ? "Läuft - Blind-Uhr gestartet" : "Noch nicht gestartet"}</span>
            </span>
          </div>
        )}

        {tournamentId && !clockStarted && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => runClockAction(startBlindClock)}
            disabled={clockBusy || !schedule}
          >
            Turnier starten
          </button>
        )}
        {tournamentId && !clockStarted && !schedule && (
          <p className={styles.hint}>Zum Starten zuerst eine Blindstruktur hinterlegen.</p>
        )}
        {clockError && <p className={styles.error}>{clockError}</p>}

        {showNewTournament ? (
          <TournamentSetupForm />
        ) : (
          <div className={styles.buttonRow}>
            {tournamentId && clockStarted && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => setConfirmReset(true)}
                disabled={clockBusy}
              >
                Timer zurücksetzen
              </button>
            )}
            <button
              type="button"
              className={tournamentId ? styles.actionButton : styles.primaryButton}
              onClick={() => setShowNewTournament(true)}
            >
              Neues Turnier anlegen
            </button>
          </div>
        )}

        {/* Chat-Wunsch: "need also a clear tournament or so for admin" - nach
            dem E11000-Vorfall gab es keinen App-Weg, ein Test-/Fehlturnier
            loszuwerden, nur manuelle Skripte direkt gegen Atlas. */}
        {tournamentId && (
          <div className={styles.dangerZone}>
            <button type="button" className={styles.dangerButton} onClick={() => setConfirmDelete(true)}>
              Turnier löschen
            </button>
          </div>
        )}
        {deleteError && <p className={styles.error}>{deleteError}</p>}
      </section>

      {tournamentId && settings && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Turnier bearbeiten</h2>
          {!showEdit ? (
            <>
              <p className={styles.hint}>Name, Rebuy, Balancing-Regeln und Halbfinale/Finale-Struktur ändern.</p>
              <button type="button" className={styles.actionButton} onClick={() => setShowEdit(true)}>
                Turnier bearbeiten
              </button>
            </>
          ) : (
            <TournamentEditForm
              tournamentId={tournamentId}
              settings={settings}
              onSaved={() => window.location.reload()}
            />
          )}
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Blindstruktur</h2>
        {tournamentId ? (
          <>
            <p className={styles.hint}>
              {schedule
                ? // computeEffectiveBlindState statt schedule.currentLevelIndex direkt:
                  // der gespeicherte Index kann seit dem letzten Schreiben durch die
                  // automatische Weiterschaltung (lib/core/blindSchedule.js) überholt
                  // sein, siehe BlindPill.js.
                  `${schedule.levels.length} Level hinterlegt, aktuell ${formatBlindLevel(
                    computeEffectiveBlindState(schedule).level
                  )}`
                : "Noch keine Blindstruktur hinterlegt."}
            </p>
            <button type="button" className={styles.actionButton} onClick={() => setShowBlindSchedule(true)}>
              Blindstruktur bearbeiten
            </button>
          </>
        ) : (
          <p className={styles.hint}>Erst nach Anlegen eines Turniers verfügbar.</p>
        )}
      </section>

      {/* Chat-Wunsch: "TV dashboard ... implement it for admin first ...
          for now reachable via admin" - eigene Seite (/dashboard) statt Modal,
          gedacht zum Spiegeln auf einen großen Screen (AirPlay/HDMI). Gate ist
          vorläufig admin-only, bis es den geplanten eigenen
          "overview"-Account gibt. */}
      {tournamentId && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>TV-Dashboard</h2>
          <p className={styles.hint}>
            Alle Tische, die volle Blindstruktur und alle Spieler auf einen Blick - für einen großen
            Screen (AirPlay/HDMI).
          </p>
          <a href="/dashboard" target="_blank" rel="noopener noreferrer" className={styles.actionButton}>
            Dashboard öffnen
          </a>
        </section>
      )}

      {showBlindSchedule && tournamentId && (
        <BlindScheduleSheet
          tournamentId={tournamentId}
          schedule={schedule}
          onClose={() => setShowBlindSchedule(false)}
          onSaved={() => {
            window.location.reload();
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          message="Blind-Uhr auf Level 1 zurücksetzen und anhalten?"
          confirmLabel="Zurücksetzen"
          danger
          onConfirm={() => runClockAction(resetBlindClock)}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`"${tournamentName}" inklusive aller Tische und Spieler unwiderruflich löschen?`}
          confirmLabel={deleting ? "Löscht…" : "Löschen"}
          danger
          onConfirm={handleDeleteTournament}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </main>
  );
}
