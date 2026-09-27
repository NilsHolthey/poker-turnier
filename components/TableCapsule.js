"use client";

import { useRef, useState } from "react";
import Seat from "./Seat";
import { seatOf, tableOrdinalFromLabel } from "@/lib/core/seating";
import { SEAT_POSITIONS } from "@/lib/client/seatPositions";
import styles from "./TableCapsule.module.css";
import seatStyles from "./Seat.module.css";
import { shortName } from "@/lib/client/formatName";

// Ab dieser Zeigerbewegung (px) gilt eine Berührung als Drag statt als
// versehentliches Zittern beim Antippen.
const DRAG_THRESHOLD_PX = 8;

// Dauer der Andock-Animation nach dem Loslassen (Chat-Wunsch: kein kurzes
// Zurückspringen auf die alte Position mehr, bevor die Server-Antwort da ist).
const SETTLE_MS = 260;

export default function TableCapsule({
  table,
  players,
  playerCount,
  phaseName,
  isGlowing,
  disabled,
  removeDisabled,
  onRemovePlayer,
  onQuickAdd,
  onReseatPlayer,
}) {
  const positions = SEAT_POSITIONS[table.maxSeats];
  const ordinal = tableOrdinalFromLabel(table.label);
  const seats = Array.from({ length: table.maxSeats }, (_, seatIndex) => {
    const player = players.find(
      (p) => seatOf(p.num, table.maxSeats) === seatIndex,
    );
    return { seatIndex, player };
  });

  // Drag & Drop innerhalb desselben Tisches (spec-Erweiterung aus dem Chat):
  // die Zustandsverwaltung sitzt hier (nicht in Seat.js), weil beim Ziehen
  // erkannt werden muss, über welchem ANDEREN Sitz sich der Zeiger befindet -
  // das setzt Kenntnis aller Sitze voraus, nicht nur des gezogenen.
  //
  // Der gezogene Spieler wird NICHT mehr über eine transform-Overlay-Variante
  // des echten Sitzes dargestellt (führte zu genau dem Bug aus dem Chat: nach
  // dem Loslassen verschwand der Transform-Override sofort, aber die noch
  // veraltenten players-Daten zeigten den Spieler kurz wieder am alten Platz,
  // bis reload() ankam). Stattdessen:
  // - der Ursprungssitz rendert ab Drag-Start sofort als leer (effectivePlayer
  //   unten), unabhängig von den echten Daten.
  // - ein separates, nicht-interaktives "Ghost"-Element (weiter unten) trägt
  //   die Drag-Visualisierung und gleitet beim Loslassen sichtbar zur
  //   Zielposition, statt zu verschwinden - erst wenn reload() UND die
  //   Andock-Animation fertig sind, verschwindet der Ghost und übergibt an die
  //   dann schon aktuellen echten Daten.
  const [drag, setDrag] = useState(null);
  const capsuleRef = useRef(null);
  const ghostRef = useRef(null);

  function handleDragPointerDown(seatIndex, player, e) {
    if (disabled || !player) return;
    // Capture bewusst auf der KAPSEL (stabiles Element), nicht auf dem
    // angefassten Circle: sobald der Ursprungssitz während des Drags als leer
    // rendert (siehe unten), würde genau dieser Circle aus dem DOM verschwinden
    // - Pointer Capture wird beim Entfernen des Capture-Elements automatisch
    // aufgehoben (Spec-Verhalten), wodurch move/up-Events ins Leere liefen und
    // der Ghost stehen blieb (Chat: "drag elemet get stuck"). Die Kapsel
    // existiert dagegen die ganze Zeit über.
    capsuleRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      pointerId: e.pointerId,
      player,
      fromSeatIndex: seatIndex,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      active: false,
      settling: false,
      hoverSeatIndex: null,
    });
  }

  function handleDragPointerMove(e) {
    if (!drag) return;
    setDrag((current) => {
      if (!current || current.settling || e.pointerId !== current.pointerId)
        return current;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;
      const active = current.active || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
      let hoverSeatIndex = current.hoverSeatIndex;
      if (active) {
        // elementFromPoint arbeitet unabhängig von Pointer Capture rein über
        // Bildschirmkoordinaten - genau das wird hier gebraucht, da die
        // Capture-Umleitung der move/up-Events nichts daran ändert, was
        // GERADE VISUELL unter dem Finger liegt.
        const el = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-seat-index]");
        hoverSeatIndex = el ? Number(el.dataset.seatIndex) : null;
      }
      return { ...current, dx, dy, active, hoverSeatIndex };
    });
  }

  function handleDragPointerUp(e) {
    // Liest den Closure-Wert statt der Updater-Funktionsform: handleDragPointerUp
    // wird bei jedem Render neu erzeugt und bekommt so immer den aktuellen
    // drag-Stand mit. Der Seiteneffekt (onReseatPlayer -> setBusy im Parent)
    // darf nicht IN einem setDrag-Updater laufen, der muss rein bleiben.
    if (!drag || drag.settling || e.pointerId !== drag.pointerId) return;
    const { active, hoverSeatIndex, fromSeatIndex, player } = drag;

    if (
      !active ||
      hoverSeatIndex === null ||
      hoverSeatIndex === fromSeatIndex
    ) {
      setDrag(null);
      return;
    }

    // Zielposition über echte DOM-Rects vermessen statt über %-Rechnung gegen
    // die responsive Kapsel-Größe - robust bei jedem Breakpoint. Der Ghost
    // bekommt den fehlenden Rest-Versatz addiert, damit er exakt mittig auf
    // dem Zielsitz andockt statt an der Loslass-Stelle stehen zu bleiben.
    const targetEl = capsuleRef.current?.querySelector(
      `[data-seat-index="${hoverSeatIndex}"]`,
    );
    let settleDx = drag.dx;
    let settleDy = drag.dy;
    if (ghostRef.current && targetEl) {
      const ghostRect = ghostRef.current.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      settleDx +=
        targetRect.left +
        targetRect.width / 2 -
        (ghostRect.left + ghostRect.width / 2);
      settleDy +=
        targetRect.top +
        targetRect.height / 2 -
        (ghostRect.top + ghostRect.height / 2);
    }
    setDrag({ ...drag, dx: settleDx, dy: settleDy, settling: true });

    Promise.all([
      Promise.resolve(onReseatPlayer(player._id, hoverSeatIndex)),
      new Promise((resolve) => setTimeout(resolve, SETTLE_MS)),
    ]).then(() => setDrag(null));
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={capsuleRef}
        className={`${styles.capsule} ${isGlowing ? "glow" : ""}`}
        style={{
          backgroundColor: `${table.color}2e`,
          borderColor: table.color,
        }}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
      >
        {/* Chat-Wunsch: "Spieler übrig/Vorrunde lebt in der eigentlichen
            Kapsel" - die Tischmitte ist sonst leeres Filz, die Sitzplätze
            sitzen alle außerhalb am Rand (lib/client/seatPositions.js). */}
        <div className={styles.centerInfo}>
          <span className={styles.centerCount}>{playerCount}</span>
          <span className={styles.centerLabel}>Spieler übrig</span>
          <span className={styles.centerPhase}>{phaseName}</span>
        </div>
        {seats.map(({ seatIndex, player }) => {
          // Sobald der Drag als solcher erkannt ist (nicht schon bei jedem
          // pointerdown - ein einfacher Tap soll den Platz nicht kurz leeren),
          // rendert der Ursprungssitz sofort leer (Chat-Wunsch), unabhängig
          // von den noch nicht aktualisierten echten Daten. Der Ghost unten
          // übernimmt die Drag-Visualisierung.
          const isOrigin = !!drag?.active && drag.fromSeatIndex === seatIndex;
          const effectivePlayer = isOrigin ? null : player;
          return (
            // Key wechselt zwischen leer/besetzt (statt fest seatIndex), damit
            // React beim Befüllen/Freiwerden eines Platzes wirklich neu montiert
            // - sonst gibt es kein Mount-Event, an dem die Eintritts-Animation
            // ansetzen könnte.
            <Seat
              key={player?._id ?? `empty-${seatIndex}`}
              seatIndex={seatIndex}
              seatNum={`${ordinal}.${seatIndex + 1}`}
              position={positions[seatIndex]}
              player={effectivePlayer}
              disabled={disabled}
              removeDisabled={removeDisabled}
              onRemove={player ? () => onRemovePlayer(player._id) : undefined}
              onQuickAdd={() => onQuickAdd(seatIndex)}
              onDragPointerDown={(e) =>
                handleDragPointerDown(seatIndex, player, e)
              }
              isDropTarget={
                !!drag?.active &&
                drag.hoverSeatIndex === seatIndex &&
                drag.fromSeatIndex !== seatIndex
              }
            />
          );
        })}
        {/* Ghost: eigenständiges, nicht-interaktives Element für die
            Drag-Visualisierung (statt einer transform-Überlagerung des echten
            Sitzes) - gleitet beim Loslassen sichtbar zur Zielposition, siehe
            handleDragPointerUp. */}
        {drag?.active && (
          <div
            ref={ghostRef}
            className={styles.ghost}
            style={{
              top: positions[drag.fromSeatIndex].top,
              left: positions[drag.fromSeatIndex].left,
              transform: `translate(calc(-50% + ${drag.dx}px), calc(-50% + ${drag.dy}px))`,
              transition: drag.settling
                ? `transform ${SETTLE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`
                : "none",
            }}
          >
            <div className={`${seatStyles.circle} ${seatStyles.dragging}`}>
              <span className={seatStyles.num}>{drag.player.num}</span>
            </div>
            <span className={seatStyles.name}>
              {shortName(drag.player.name)}
            </span>
            {drag.player.isBank && (
              <span className={seatStyles.bankBadge} aria-label="Bank">
                <span className={seatStyles.bankWord}>Bank</span> $
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
