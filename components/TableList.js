"use client";

import { useEffect } from "react";
import { seatOf } from "@/lib/core";
import { tableOrdinalFromLabel } from "@/lib/core/seating";
import styles from "./TableList.module.css";
import { shortName } from "@/lib/client/formatName";

function statusOf(count, config) {
  if (count <= config.dissolveThreshold) return "critical";
  if (count < config.baseline) return "warning";
  return "ok";
}

// Klick auf eine Tisch-Karte klappt die Sitzplätze dieses Tisches direkt als
// Liste auf (statt in die Tische-Ansicht zu wechseln) - inklusive Hinzufügen/
// Entfernen, ohne die Ansicht verlassen zu müssen. Optik nach dem
// Leaderboard-Muster aus dem anderen Projekt (Chat): Karte mit großer Zahl,
// Name, dünnem Balken (hier: Sitzbelegung) und großem Wert (hier: n/max).
// Bewusst immer nur EINE Karte offen und keine offen vorbelegt (Chat), weil
// ein Tap zugleich den aktiven Tisch wechselt und der Detailbereich hoch ist.
export default function TableList({
  tables,
  players,
  config,
  myTableId,
  glowTableIds = [],
  onSelectTable,
  onRemovePlayer,
  onQuickAdd,
  canEditTable,
  busy,
  expandedTableId,
  onExpandedChange,
}) {
  // Aufgeklappt-Zustand liegt im TournamentBoard (Chat: "Dein Tisch" in der
  // BottomNav soll in der Liste den eigenen Tisch aufklappen können).
  // Nach dem Aufklappen in den sichtbaren Bereich scrollen - erst nach der
  // Höhen-Transition (0.2s), sonst wird auf die noch zugeklappte Höhe gemessen.
  useEffect(() => {
    if (!expandedTableId) return;
    const timer = setTimeout(() => {
      document.getElementById(`table-card-${expandedTableId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 220);
    return () => clearTimeout(timer);
  }, [expandedTableId]);

  function toggleTable(tableId) {
    onExpandedChange(expandedTableId === tableId ? null : tableId);
    onSelectTable?.(tableId);
  }

  return (
    <ul className={styles.list}>
      {tables.map((table, index) => {
        const tablePlayers = players.filter((p) => p.tableId === table._id);
        const status = statusOf(tablePlayers.length, config);
        const expanded = expandedTableId === table._id;
        // Chat-Wunsch: operator darf nur den eigenen Tisch bearbeiten - die
        // eigentliche Durchsetzung sitzt serverseitig, das hier ist nur die
        // UI-Spiegelung (siehe lib/authz.js canManageTable).
        const editable = canEditTable ? canEditTable(table) : true;
        const rowDisabled = busy || !editable;
        return (
          <li
            key={table._id}
            id={`table-card-${table._id}`}
            className={styles.item}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div
              className={`${styles.card} ${table._id === myTableId ? styles.cardMe : ""} ${
                expanded ? styles.cardOpen : ""
              } ${styles[status]} ${glowTableIds.includes(table._id) ? "glow" : ""}`}
            >
              <button
                type="button"
                className={styles.row}
                onClick={() => toggleTable(table._id)}
                aria-expanded={expanded}
              >
                <span className={styles.rank} style={{ color: table.color }}>
                  {tableOrdinalFromLabel(table.label)}
                </span>
                <span className={styles.info}>
                  <span className={styles.name}>
                    {table.label}
                    {table._id === myTableId && (
                      <span className={styles.you}>Dein Tisch</span>
                    )}
                  </span>
                  <span className={styles.bar}>
                    <span
                      className={styles.barFill}
                      style={{
                        width: `${Math.min(100, (tablePlayers.length / table.maxSeats) * 100)}%`,
                        background: table.color,
                      }}
                    />
                  </span>
                </span>
                <span className={styles.pts}>
                  {tablePlayers.length}
                  <span className={styles.ptsMax}>/{table.maxSeats}</span>
                </span>
                <svg
                  className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Immer im DOM (nicht nur wenn expanded), sonst gäbe es nichts,
                dessen Höhe animiert werden könnte - grid-template-rows von 0fr
                auf 1fr ist der gängige CSS-only Trick für eine Höhen-Transition
                auf Inhalt mit unbekannter/variabler Höhe. */}
              <div
                className={`${styles.detailWrapper} ${expanded ? styles.detailWrapperOpen : ""}`}
              >
                <div className={styles.detailInner}>
                  <div className={styles.detail}>
                    {Array.from({ length: table.maxSeats }, (_, seatIndex) => {
                      const player = tablePlayers.find(
                        (p) => seatOf(p.num, table.maxSeats) === seatIndex,
                      );
                      return (
                        <div key={seatIndex} className={styles.detailRow}>
                          {player ? (
                            <>
                              <span className={styles.detailNum}>
                                {player.num}
                              </span>
                              <span className={styles.detailName}>
                                <span title={player.name}>{shortName(player.name)}</span>
                                {player.isBank && (
                                  <span className={styles.detailBank} aria-label="Bank">
                                    <span className={styles.bankWord}>Bank</span> $
                                  </span>
                                )}
                              </span>
                              <button
                                type="button"
                                className={styles.detailRemove}
                                onClick={() => onRemovePlayer(player._id)}
                                disabled={busy}
                                aria-label={`${player.name} entfernen`}
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={styles.detailAdd}
                              onClick={() => onQuickAdd(table._id, seatIndex)}
                              disabled={rowDisabled}
                            >
                              + Spieler hinzufügen
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
