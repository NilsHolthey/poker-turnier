"use client";

import { useState } from "react";
import BackButton from "./BackButton";
import ConfirmDialog from "./ConfirmDialog";
import { addPlayer, renamePlayer, removePlayerEntry } from "@/lib/client/api";
import { shortName, findNameCollision } from "@/lib/client/formatName";
import styles from "./PlayerListBoard.module.css";

// Chat-Wunsch: "as admin I need a site with the full player list. this list
// can be reachable via hamburger menu by all. but only admin can remove or
// add or edit here even after tournament start" - für ALLE Rollen sichtbar
// (reiner Lesezugriff für operator), Mutations-Controls (hinzufügen,
// umbenennen, entfernen) nur für admin, unabhängig von der Rebuy-Phase (die
// bestehenden add/rename-Routen erlauben admin ohnehin schon immer, siehe
// lib/authz.js canManageTable + die Rollen-Prüfungen in den Routen selbst -
// hier geht es nur darum, die UI entsprechend zu zeigen/zu verstecken).
//
// "this will an edit not a bust if a player gets removed" - entfernen hier
// nutzt die NEUE removePlayerEntry()-Route (harte Löschung, kein
// status:"busted"), nicht das bestehende removePlayer() (Bust-out, siehe
// TournamentBoard.js).
//
// Reload statt Live-Reconciliation nach jeder Aktion (wie AdminBoard.js'
// runClockAction) - das hier ist ein gelegentliches Korrektur-Werkzeug, kein
// Live-Spielstand-Board mit Polling, ein einfacher Reload reicht.
export default function PlayerListBoard({ tournamentId, tournamentName, initialPlayers, tables, user }) {
  const tableById = new Map(tables.map((t) => [t._id, t]));
  // Chat-Wunsch: "when we open the dropdown to add a player to a specific
  // table we should only show the tables that actually have an open seat" -
  // ein voller Tisch würde addPlayer() (lib/db/tournamentEngine.js) ohnehin
  // mangels freiem Sitzplatz ablehnen, jetzt aber schon in der Auswahl gar
  // nicht erst anbieten statt erst nach einem fehlschlagenden Versuch.
  const activeCountByTable = new Map();
  for (const p of initialPlayers) {
    if (p.status === "active") {
      activeCountByTable.set(p.tableId, (activeCountByTable.get(p.tableId) ?? 0) + 1);
    }
  }
  const openTables = tables.filter((t) => (activeCountByTable.get(t._id) ?? 0) < t.maxSeats);

  const [newName, setNewName] = useState("");
  const [newTableId, setNewTableId] = useState(openTables[0]?._id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const isAdmin = user?.role === "admin";
  // Aktive Spieler zuerst (nach Tisch/Sitz sortiert), gebustete danach -
  // localeCompare mit numeric:true, damit "10.1" nach "2.1" einsortiert statt
  // davor (reiner String-Vergleich würde "10" vor "2" einordnen).
  const sortedPlayers = [...initialPlayers].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    return (a.num ?? "").localeCompare(b.num ?? "", "de", { numeric: true });
  });

  const collision = findNameCollision(newName, initialPlayers);

  async function runAction(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      // Einfachster Weg, die Liste nach einer Mutation wieder konsistent zu
      // zeigen - die Seite ist ein Server-Component-Read (app/players/page.js),
      // kein eigener Live-State mit Polling wie TournamentBoard.js.
      window.location.reload();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || !newTableId) return;
    runAction(() => addPlayer(tournamentId, { tableId: newTableId, name: trimmed }));
  }

  function handleRenameBlur(playerId, e) {
    const value = e.target.value.trim();
    if (!value) return;
    runAction(() => renamePlayer(tournamentId, playerId, value));
  }

  function confirmRemoveAction() {
    const playerId = confirmRemove?.playerId;
    setConfirmRemove(null);
    if (!playerId) return;
    runAction(() => removePlayerEntry(tournamentId, playerId));
  }

  return (
    <main className={styles.page}>
      <BackButton />
      <div className={styles.header}>
        <h1 className={styles.title}>{tournamentName}</h1>
        <span className={styles.subtitle}>Spielerliste · {initialPlayers.length} gesamt</span>
      </div>

      {isAdmin && (
        <form className={styles.addCard} onSubmit={handleAdd}>
          <span className={styles.addLabel}>Spieler hinzufügen</span>
          <div className={styles.addRow}>
            <input
              type="text"
              className={styles.addInput}
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              enterKeyHint="done"
              disabled={busy || openTables.length === 0}
              required
            />
            <button type="submit" className={styles.addButton} disabled={busy || !newName.trim() || !newTableId}>
              +
            </button>
          </div>
          {/* Pillen-Reihe statt <select> (gleiches Muster + gleicher Grund wie
              in BlindScheduleSheet.js, Chat-Wunsch dort: "opens native ui
              style" - ein natives Dropdown lässt sich nicht ins dunkle
              Glas-Design einpassen, eine Pillen-Reihe bleibt im selben Look). */}
          <div className={styles.tablePills}>
            {openTables.map((t) => (
              <button
                key={t._id}
                type="button"
                className={`${styles.tablePill} ${newTableId === t._id ? styles.tablePillActive : ""}`}
                style={{ borderColor: newTableId === t._id ? t.color : undefined, color: t.color }}
                onClick={() => setNewTableId(t._id)}
                disabled={busy}
              >
                {t.label}
              </button>
            ))}
          </div>
          {openTables.length === 0 && <p className={styles.hint}>Kein Tisch mit freiem Sitzplatz vorhanden.</p>}
          {collision && (
            <p className={styles.warning}>
              Es gibt bereits „{collision.name}“{tableById.get(collision.tableId)?.label ? ` (${tableById.get(collision.tableId).label})` : ""}
            </p>
          )}
        </form>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.listCard}>
        {sortedPlayers.map((player) => {
          const busted = player.status !== "active";
          const table = tableById.get(player.tableId);
          return (
            <div key={player._id} className={`${styles.row} ${busted ? styles.rowBusted : ""}`}>
              <span className={styles.seatNum}>{player.num ?? "—"}</span>

              {isAdmin ? (
                <input
                  type="text"
                  className={styles.nameInput}
                  defaultValue={player.name}
                  onBlur={(e) => handleRenameBlur(player._id, e)}
                  onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  enterKeyHint="done"
                  disabled={busy}
                />
              ) : (
                <span className={styles.name}>{shortName(player.name)}</span>
              )}

              {player.isBank && <span className={styles.bank}>Bank $</span>}

              <span className={styles.tableLabel} style={{ color: table?.color }}>
                {busted ? "Ausgeschieden" : table?.label ?? "—"}
              </span>

              {isAdmin && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => setConfirmRemove({ playerId: player._id, name: player.name })}
                  disabled={busy}
                  aria-label={`${player.name} entfernen`}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {confirmRemove && (
        <ConfirmDialog
          message={`${confirmRemove.name} wirklich aus der Spielerliste entfernen? Das ist keine Bust-Markierung, der Spieler existiert danach nicht mehr.`}
          confirmLabel="Entfernen"
          danger
          onConfirm={confirmRemoveAction}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </main>
  );
}
