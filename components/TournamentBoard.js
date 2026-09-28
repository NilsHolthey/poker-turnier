"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "./BottomNav";
import BlindPill from "./BlindPill";
import HamburgerMenu from "./HamburgerMenu";
import TableTabs from "./TableTabs";
import TableCapsule from "./TableCapsule";
import TableList from "./TableList";
import ManageTableSheet from "./ManageTableSheet";
import BlindScheduleSheet from "./BlindScheduleSheet";
import DrawDialog from "./DrawDialog";
import FullScreenAlert from "./FullScreenAlert";
import ConfirmDialog from "./ConfirmDialog";
import Toast from "./Toast";
import DissolveOverview from "./DissolveOverview";
import {
  fetchTournamentState,
  removePlayer,
  addPlayer,
  renamePlayer,
  reseatPlayer,
  confirmMove,
  rerollMove,
  endPhase,
  setBlindLevelIndex,
  startBlindClock,
} from "@/lib/client/api";
import { PHASES } from "@/lib/constants";
import styles from "./TournamentBoard.module.css";

const ROLLING_DURATION_MS = 1300;

// Builds the display model for the current draw proposal from raw IDs + the
// client's cached tables/players, and works out whether "Neu auslosen" still has
// an untried candidate left (spec: "Keine Alternative verfügbar" disables reroll).
function buildDrawViewModel(proposal, state, rejectedIds) {
  if (!proposal || !state) return null;
  const { tables, players } = state;
  const findTable = (id) => tables.find((t) => t._id === id);
  const findPlayer = (id) => players.find((p) => p._id === id);

  const isDissolve = proposal.type === "dissolve";
  const sourceTableId = isDissolve ? proposal.dissolvedTableId : proposal.fromTableId;
  const fromTable = findTable(sourceTableId);

  if (isDissolve) {
    const toTable = proposal.toTableId ? findTable(proposal.toTableId) : null;
    const player = findPlayer(proposal.playerId);
    const candidatePool = tables.filter((t) => t._id !== sourceTableId);
    return {
      isDissolve: true,
      playerNum: player?.num,
      playerName: player?.name,
      playerIsBank: player?.isBank,
      fromLabel: fromTable?.label,
      fromColor: fromTable?.color,
      toLabel: toTable?.label,
      toColor: toTable?.color,
      canReroll: !!proposal.toTableId && rejectedIds.length + 1 < candidatePool.length,
      noAlternative: !proposal.toTableId,
    };
  }

  const toTable = findTable(proposal.toTableId);
  const player = proposal.playerId ? findPlayer(proposal.playerId) : null;
  const candidatePool = players.filter((p) => p.tableId === sourceTableId);
  return {
    isDissolve: false,
    playerNum: player?.num,
    playerName: player?.name,
    playerIsBank: player?.isBank,
    fromLabel: fromTable?.label,
    fromColor: fromTable?.color,
    toLabel: toTable?.label,
    toColor: toTable?.color,
    canReroll: !!proposal.playerId && rejectedIds.length + 1 < candidatePool.length,
    noAlternative: !proposal.playerId,
  };
}

export default function TournamentBoard({ tournamentId, initialState, user }) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState(null);
  const [view, setView] = useState("tische");
  const [activeTableId, setActiveTableId] = useState(null);
  const [expandedTableId, setExpandedTableId] = useState(null);
  // Fest an den Login-Account gebunden (ein Operator-Account pro Tisch, spec)
  // - niemand kann das manuell ändern.
  const myTableId = user?.myTableId ?? null;
  const [manageTableId, setManageTableId] = useState(null);
  const [showBlindSchedule, setShowBlindSchedule] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [drawPhase, setDrawPhase] = useState(null);
  const [rejectedIds, setRejectedIds] = useState([]);
  const [signal, setSignal] = useState(null);
  const [busy, setBusy] = useState(false);
  // In-App-Bestätigungsdialoge statt window.confirm() (Chat-Wunsch: "inside
  // the app a popup not per browser").
  const [confirmRemovePlayer, setConfirmRemovePlayer] = useState(null);
  const [confirmEndPhase, setConfirmEndPhase] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // Kurzer Hinweis-Toast, wenn ein Operator einen Spieler an einem fremden
  // Tisch entfernen will (Chat-Wunsch). id sorgt dafür, dass ein zweiter Tap
  // innerhalb der Anzeigedauer den Toast neu startet.
  const [denyToast, setDenyToast] = useState(null);
  // Sammelt die einzelnen Umsetzungen einer Tisch-Auflösung, damit am Ende EIN
  // Übersichts-Popup gezeigt werden kann (Chat-Wunsch).
  const dissolveLogRef = useRef([]);
  const [dissolveOverview, setDissolveOverview] = useState(null);
  // Wischen links/rechts in der Tische-Ansicht wechselt zum nächsten/vorigen
  // Tisch (Chat-Wunsch); slideDirection steuert, von welcher Seite der neue
  // Tisch hereingleitet.
  const swipeStartRef = useRef(null);
  const [slideDirection, setSlideDirection] = useState(null);

  useEffect(() => {
    if (!denyToast) return;
    const timer = setTimeout(() => setDenyToast(null), 2200);
    return () => clearTimeout(timer);
  }, [denyToast]);

  async function reload() {
    const data = await fetchTournamentState(tournamentId);
    setState(data);
    return data;
  }

  // Polling zusätzlich zu Web Push (spec-Erweiterung, siehe Chat: "trotzdem
  // polling einführen damit alle tische aktuell sind") - Push kann pro Gerät
  // fehlen (Berechtigung verweigert, Browser unterstützt es nicht, Subscription
  // stillschweigend abgelaufen), Polling hält den Stand trotzdem synchron.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTournamentState(tournamentId).then(setState).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  function startDraw(action) {
    setRejectedIds([]);
    setPendingAction(action);
    setDrawPhase("rolling");
    setTimeout(() => setDrawPhase("confirm"), ROLLING_DURATION_MS);
  }

  async function runAction(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleRemovePlayer(playerId) {
    // Chat-Wunsch: Entfernen (Bust-out) braucht eine Bestätigung - ein
    // versehentliches Antippen des ×-Buttons wäre sonst nicht rückgängig zu
    // machen. Einziger Aufrufort für beide UI-Einstiege (TableCapsule-Sitz und
    // TableList-Inline-Zeile), also reicht die Bestätigung hier zentral.
    const player = players.find((p) => p._id === playerId);
    const playerTable = tables.find((t) => t._id === player?.tableId);
    if (!canManageTable(playerTable)) {
      setDenyToast((prev) => ({ id: (prev?.id ?? 0) + 1, text: "Du kannst nur Spieler an deinem Tisch löschen" }));
      return;
    }
    setConfirmRemovePlayer({ playerId, name: player?.name ?? "Spieler" });
  }

  function confirmRemovePlayerAction() {
    const playerId = confirmRemovePlayer?.playerId;
    setConfirmRemovePlayer(null);
    if (!playerId) return;
    runAction(async () => {
      const { pendingAction: next } = await removePlayer(tournamentId, playerId);
      await reload();
      if (next) startDraw(next);
    });
  }

  function handleQuickAdd(tableId, seatIndex) {
    runAction(async () => {
      await addPlayer(tournamentId, { tableId, seatIndex });
      await reload();
    });
  }

  function handleReseatPlayer(playerId, seatIndex) {
    // Anders als die übrigen runAction-Aufrufe hier: gibt das Promise zurück,
    // damit TableCapsule den Drag-Ghost erst entfernt, wenn die frischen Daten
    // wirklich angekommen sind (sonst kurzes Zurückspringen auf die alte
    // Position, siehe Chat).
    return runAction(async () => {
      await reseatPlayer(tournamentId, playerId, seatIndex);
      await reload();
    });
  }

  function handleManageAdd(name) {
    if (!manageTableId) return;
    runAction(async () => {
      await addPlayer(tournamentId, { tableId: manageTableId, name });
      await reload();
    });
  }

  function handleRename(playerId, name) {
    runAction(async () => {
      await renamePlayer(tournamentId, playerId, name);
      await reload();
    });
  }

  function handleConfirm() {
    if (!pendingAction) return;
    const vm = drawViewModel;
    const fromId = pendingAction.type === "dissolve" ? pendingAction.dissolvedTableId : pendingAction.fromTableId;
    const toId = pendingAction.toTableId;

    const isDissolve = pendingAction.type === "dissolve";
    const playerId = pendingAction.playerId;

    runAction(async () => {
      const { pendingAction: next } = await confirmMove(tournamentId, pendingAction);
      const data = await reload();
      setSignal({ fromTableId: fromId, toTableId: toId, text: `${vm?.playerNum ?? "?"} setzt um zu ${vm?.toLabel ?? "?"}` });
      setTimeout(() => setSignal(null), ROLLING_DURATION_MS);

      if (isDissolve) {
        dissolveLogRef.current.push({
          name: vm?.playerName,
          isBank: vm?.playerIsBank,
          fromNum: vm?.playerNum,
          newNum: data.players.find((p) => p._id === playerId)?.num,
          toLabel: vm?.toLabel,
          toColor: vm?.toColor,
        });
        // Der aufgelöste Tisch existiert nicht mehr - sofort auf den Zieltisch
        // wechseln statt einen leeren Bildschirm zu zeigen (Chat-Wunsch).
        if (!data.tables.some((t) => t._id === fromId)) setActiveTableId(toId);
      }

      const sameDissolveContinues = next?.type === "dissolve" && next.dissolvedTableId === fromId;
      if (isDissolve && !sameDissolveContinues) {
        // Auflösung fertig: eine Übersicht statt vieler einzelner Popups. Die
        // nächste Auslosung (falls vorhanden) startet erst nach dem Schließen.
        const moves = dissolveLogRef.current;
        dissolveLogRef.current = [];
        setPendingAction(null);
        setDrawPhase(null);
        setDissolveOverview({ tableLabel: vm?.fromLabel, moves, nextAction: next });
      } else if (next) {
        startDraw(next);
      } else {
        setPendingAction(null);
        setDrawPhase(null);
      }
    });
  }

  function closeDissolveOverview() {
    const next = dissolveOverview?.nextAction;
    setDissolveOverview(null);
    if (next) startDraw(next);
  }

  function handleReroll() {
    if (!pendingAction || !drawViewModel?.canReroll) return;
    const rejectedId = pendingAction.type === "dissolve" ? pendingAction.toTableId : pendingAction.playerId;
    const nextExcluded = [...rejectedIds, rejectedId];

    runAction(async () => {
      setRejectedIds(nextExcluded);
      setDrawPhase("rolling");
      const { proposal } = await rerollMove(tournamentId, pendingAction, nextExcluded);
      setPendingAction(proposal);
      setTimeout(() => setDrawPhase("confirm"), ROLLING_DURATION_MS);
    });
  }

  function handleAdvanceBlindLevel(index) {
    runAction(async () => {
      await setBlindLevelIndex(tournamentId, index);
      await reload();
    });
  }

  function handleStartBlindClock() {
    runAction(async () => {
      await startBlindClock(tournamentId);
      await reload();
    });
  }

  function handleEndPhase() {
    setConfirmEndPhase(true);
  }

  function confirmEndPhaseAction() {
    setConfirmEndPhase(false);
    runAction(async () => {
      await endPhase(tournamentId);
      await reload();
      setActiveTableId(null);
    });
  }

  const drawViewModel = buildDrawViewModel(pendingAction, state, rejectedIds);
  const glowTableIds = signal ? [signal.fromTableId, signal.toTableId].filter(Boolean) : [];

  const { tournament, tables, players } = state;
  // Zeigt nie einen nicht (mehr) existierenden Tisch: nach einer Auflösung ist
  // activeTableId/myTableId evtl. veraltet - dann auf den ersten passenden
  // aktiven Tisch ausweichen (gilt auch für Geräte, die per Polling nachziehen).
  const effectiveActiveTableId =
    [activeTableId, myTableId, tables[0]?._id].find((id) => id && tables.some((t) => t._id === id)) ?? null;
  const activeTable = tables.find((t) => t._id === effectiveActiveTableId);
  const manageTable = tables.find((t) => t._id === manageTableId);
  const hasNextPhase = tournament.phaseIndex < PHASES.length - 1;
  // Chat-Wunsch: operator darf nur den eigenen Tisch verwalten (sonst könnten
  // Spieler an fremden Tischen umbenannt/entfernt werden) - die eigentliche
  // Durchsetzung sitzt serverseitig in den Routen (lib/authz.js
  // canManageTable), das hier ist nur die UI-Spiegelung davon.
  function canManageTable(table) {
    return user?.role === "admin" || (!!table && table._id === myTableId);
  }
  const canManageActiveTable = canManageTable(activeTable);

  function selectTable(tableId) {
    const from = tables.findIndex((t) => t._id === effectiveActiveTableId);
    const to = tables.findIndex((t) => t._id === tableId);
    if (to === -1 || to === from) return;
    setSlideDirection(to > from ? "next" : "prev");
    setActiveTableId(tableId);
  }

  function handleSwipeStart(e) {
    // Auf einem Spieler-Kreis beginnt der Drag zum Umsetzen (TableCapsule) -
    // der darf nicht gleichzeitig als Wischen zählen.
    if (e.touches.length !== 1 || e.target.closest("[data-no-swipe]")) {
      swipeStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY, time: e.timeStamp };
  }

  function handleSwipeEnd(e) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Nur klar horizontale, zügige Gesten - vertikales Scrollen bleibt unberührt.
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || e.timeStamp - start.time > 700) return;
    const index = tables.findIndex((t) => t._id === effectiveActiveTableId);
    const target = tables[index + (dx < 0 ? 1 : -1)];
    if (target) selectTable(target._id);
  }

  return (
    <div className={styles.board}>
      <div className={styles.container}>
        <header className={styles.header}>
          <HamburgerMenu user={user} onLogout={() => setConfirmLogout(true)} />
          {/* Ein Verwalten-Icon fürs jeweils aktive Tisch statt getrennter
              Buttons in Kopfzeile/"Dein Tisch"/unter der Kapsel (Chat-Redesign:
              "top right we will have the edit / verwalten button"). Ersetzt
              damit auch den alten Verwalten-Button in tableActionsRow. */}
          {canManageActiveTable && activeTable && (
            <button
              type="button"
              className={`${styles.headerIconButton} glassChrome`}
              onClick={() => setManageTableId(activeTable._id)}
              aria-label={`${activeTable.label} verwalten`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
          )}
        </header>

        {/* Eigene oben zentrierte Pille wie Hamburger/Verwalten (Chat-Redesign:
            "blines shoul live centered top now ... like notch on iphone"). */}
        <BlindPill
          schedule={tournament.blindSchedule}
          isAdmin={user?.role === "admin"}
          onAdvance={handleAdvanceBlindLevel}
          onStart={handleStartBlindClock}
          onEdit={() => setShowBlindSchedule(true)}
          busy={busy}
        />

        <div className={styles.panel}>
          {view === "tische" ? (
            <div
              className={styles.capsuleArea}
              onTouchStart={handleSwipeStart}
              onTouchEnd={handleSwipeEnd}
              onTouchCancel={() => (swipeStartRef.current = null)}
            >
              <TableTabs
                tables={tables}
                activeTableId={effectiveActiveTableId}
                onSelect={selectTable}
                glowTableIds={glowTableIds}
              />
              {activeTable && (
                <div
                  key={activeTable._id}
                  className={
                    slideDirection === "next"
                      ? styles.slideFromRight
                      : slideDirection === "prev"
                        ? styles.slideFromLeft
                        : undefined
                  }
                >
                  <TableCapsule
                    key={activeTable._id}
                    table={activeTable}
                    players={players.filter((p) => p.tableId === activeTable._id)}
                    playerCount={players.length}
                    phaseName={PHASES[tournament.phaseIndex].name}
                    isGlowing={glowTableIds.includes(activeTable._id)}
                    disabled={busy || !canManageActiveTable}
                    removeDisabled={busy}
                    onRemovePlayer={handleRemovePlayer}
                    onQuickAdd={(seatIndex) => handleQuickAdd(activeTable._id, seatIndex)}
                    onReseatPlayer={handleReseatPlayer}
                  />
                </div>
              )}
            </div>
          ) : (
            <TableList
              tables={tables}
              players={players}
              config={tournament.config}
              myTableId={myTableId}
              glowTableIds={glowTableIds}
              onSelectTable={setActiveTableId}
              expandedTableId={expandedTableId}
              onExpandedChange={setExpandedTableId}
              onRemovePlayer={handleRemovePlayer}
              onQuickAdd={handleQuickAdd}
              canEditTable={canManageTable}
              busy={busy}
            />
          )}
        </div>

        {error && <p className={styles.status}>{error}</p>}
      </div>

      <BottomNav
        view={view}
        onChangeView={setView}
        busy={busy}
        phaseAction={
          user?.role === "admin" && hasNextPhase
            ? { label: `${PHASES[tournament.phaseIndex + 1].shortName} starten`, onClick: handleEndPhase }
            : null
        }
        showNotifications={user?.role === "operator" || user?.role === "admin"}
        myTable={tables.find((t) => t._id === myTableId)}
        onSelectMyTable={() => {
          setActiveTableId(myTableId);
          // In der Liste klappt "Dein Tisch" den eigenen Tisch auf, in der
          // Tische-Ansicht springt es wie bisher auf den Tab (Chat).
          if (view !== "tische") setExpandedTableId(myTableId);
        }}
      />

      {showBlindSchedule && (
        <BlindScheduleSheet
          tournamentId={tournamentId}
          schedule={tournament.blindSchedule}
          onClose={() => setShowBlindSchedule(false)}
          onSaved={async () => {
            setShowBlindSchedule(false);
            await reload();
          }}
        />
      )}

      {manageTable && (
        <ManageTableSheet
          table={manageTable}
          players={players.filter((p) => p.tableId === manageTable._id)}
          onAdd={handleManageAdd}
          onRename={handleRename}
          onClose={() => setManageTableId(null)}
          busy={busy}
        />
      )}

      {drawPhase && drawViewModel && (
        <DrawDialog
          phase={drawPhase}
          playerNum={drawViewModel.playerNum}
          playerName={drawViewModel.playerName}
          playerIsBank={drawViewModel.playerIsBank}
          isDissolve={drawViewModel.isDissolve}
          fromLabel={drawViewModel.fromLabel}
          fromColor={drawViewModel.fromColor}
          toLabel={drawViewModel.toLabel}
          toColor={drawViewModel.toColor}
          noAlternative={drawViewModel.noAlternative}
          onConfirm={handleConfirm}
          onReroll={handleReroll}
          busy={busy}
        />
      )}

      {dissolveOverview && (
        <DissolveOverview
          tableLabel={dissolveOverview.tableLabel}
          moves={dissolveOverview.moves}
          onClose={closeDissolveOverview}
        />
      )}

      {signal && <FullScreenAlert text={signal.text} />}

      {confirmRemovePlayer && (
        <ConfirmDialog
          message={`${confirmRemovePlayer.name} wirklich entfernen (Bust-out)?`}
          confirmLabel="Entfernen"
          danger
          onConfirm={confirmRemovePlayerAction}
          onCancel={() => setConfirmRemovePlayer(null)}
        />
      )}

      {confirmEndPhase && (
        <ConfirmDialog
          message={`Alle ${players.length} Spieler werden neu auf ${PHASES[tournament.phaseIndex + 1].targetTables} Tische verteilt, aktuelle Aufteilung geht verloren. ${PHASES[tournament.phaseIndex].name} beenden?`}
          confirmLabel="Beenden"
          onConfirm={confirmEndPhaseAction}
          onCancel={() => setConfirmEndPhase(false)}
        />
      )}

      {denyToast && <Toast key={denyToast.id} text={denyToast.text} />}

      {confirmLogout && (
        <ConfirmDialog
          message="Wirklich abmelden?"
          confirmLabel="Abmelden"
          danger
          onConfirm={() => {
            // Echte Browser-Navigation statt Next-Router nötig: /auth/logout
            // ist eine Auth0-SDK-Routen (kein Next.js-Page), die Cookies
            // löscht und serverseitig zu Auth0 weiterleitet - ein
            // client-seitiger router.push() würde das nicht korrekt anstoßen.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.href = "/auth/logout";
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </div>
  );
}
