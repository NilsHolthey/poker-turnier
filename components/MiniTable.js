import { seatOf, tableOrdinalFromLabel } from "@/lib/core/seating";
import { SEAT_POSITIONS } from "@/lib/client/seatPositions";
import { shortName } from "@/lib/client/formatName";
import styles from "./MiniTable.module.css";

// Stark verkleinerte, rein lesende Variante von TableCapsule fürs
// TV-Dashboard (Chat-Wunsch: "all tables shown at once ... mini version [of
// the felt table] but we do not need remove button and/or players left info
// etc") - kein Drag&Drop, kein Hinzufügen/Entfernen, keine Center-Info, nur
// Sitzplätze + Namen zum Ablesen aus der Distanz.
//
// active=false (Chat-Wunsch: "do not remove the table when it's deleted but
// rather show a greyed out version so we always have the 8 tables") - ein
// aufgelöster Tisch hat per Definition keine aktiven Spieler mehr (alle
// wurden umgesetzt), die Sitze rendern also ohnehin schon leer; hier kommt
// nur noch die visuelle Ausgrauung dazu, statt den Tisch aus dem Raster
// verschwinden zu lassen.
//
// Fallback, solange DashboardBoard.js die echte .tablesArea-Größe noch nicht
// per ResizeObserver gemessen hat (erster Render vor dem ersten Paint-Tick) -
// klein genug, um auch bei 3 Zeilen nie zu überlaufen.
const DEFAULT_CAPSULE_SIZE = { width: 60, height: 80, slotWidth: 70 };

// capsuleSize kommt aus DashboardBoard.js (computeCapsuleSize, aus der
// TATSÄCHLICH gemessenen .tablesArea-Fläche berechnet) statt aus CSS-
// Prozent/aspect-ratio (Bugreport: Kapsel ist bei 3 Zeilen auf ~0
// kollabiert, weil %-Höhe + aspect-ratio in dieser Verschachtelung nicht
// zuverlässig aufgelöst hat und die absolut positionierten Sitze dadurch
// alle auf denselben Punkt fielen). Circle/Name-Maße werden hier direkt als
// Anteil der Kapselbreite abgeleitet, damit sie IMMER proportional
// mitskalieren statt an einem eigenen vh/cqh-Minimum hängenzubleiben.
export default function MiniTable({ table, players, active = true, capsuleSize }) {
  const positions = SEAT_POSITIONS[table.maxSeats];
  const ordinal = tableOrdinalFromLabel(table.label);
  const { width: capsuleWidth, height: capsuleHeight, slotWidth } = capsuleSize || DEFAULT_CAPSULE_SIZE;

  const circleDiameter = Math.max(12, Math.min(46, capsuleWidth * 0.28));
  const circleFontSize = circleDiameter * 0.4;
  const nameFontSize = circleDiameter * 0.34;
  const nameMaxWidth = capsuleWidth * 1.05;
  // War vorher eine eigene Zeile ÜBER der Kapsel - dafür ist bei der
  // 1180x820-Zielgröße schlicht keine Höhe übrig (Bugreport: "table titles
  // are still behind the table/player, we do not have the space") - jetzt
  // einfach die Tischnummer mittig IN der Kapsel, dort ist ohnehin freie
  // Fläche (die Spieler sitzen alle außerhalb am Rand, siehe SEAT_POSITIONS).
  const centerFontSize = Math.max(10, Math.min(26, capsuleWidth * 0.32));

  return (
    // width: slotWidth statt nur der (absichtlich kleineren) Kapselbreite -
    // reserviert den in computeCapsuleSize eingerechneten Puffer für seitlich
    // überstehende Sitze auch WIRKLICH im Layout (Bugfix, siehe Kommentar
    // dort), flex-shrink:0 verhindert, dass Flexbox diesen Puffer unter
    // Platzdruck wieder wegschrumpft.
    <div
      className={`${styles.wrapper} ${!active ? styles.inactive : ""}`}
      style={{ width: `${slotWidth}px`, flexShrink: 0 }}
    >
      {positions ? (
        <div
          className={styles.capsule}
          style={{
            width: `${capsuleWidth}px`,
            height: `${capsuleHeight}px`,
            borderColor: active ? table.color : undefined,
          }}
        >
          <span
            className={styles.centerLabel}
            style={{ color: active ? table.color : undefined, fontSize: `${centerFontSize}px` }}
          >
            {ordinal}
          </span>

          {positions.map((pos, seatIndex) => {
            const player = players.find((p) => seatOf(p.num, table.maxSeats) === seatIndex);
            return (
              <div key={seatIndex} className={styles.seat} style={{ top: pos.top, left: pos.left }}>
                {player ? (
                  <>
                    <span
                      className={styles.circle}
                      style={{
                        width: `${circleDiameter}px`,
                        height: `${circleDiameter}px`,
                        fontSize: `${circleFontSize}px`,
                      }}
                    >
                      {ordinal}.{seatIndex + 1}
                    </span>
                    <span
                      className={styles.name}
                      style={{ maxWidth: `${nameMaxWidth}px`, fontSize: `${nameFontSize}px` }}
                    >
                      {shortName(player.name)}
                      {player.isBank && <span className={styles.bank}>$</span>}
                    </span>
                  </>
                ) : (
                  <span
                    className={styles.emptyCircle}
                    style={{ width: `${circleDiameter}px`, height: `${circleDiameter}px` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback für Tischgrößen ohne definiertes Sitzplatz-Layout
        // (SEAT_POSITIONS kennt nur 6/8) - einfache Liste statt Filz-Grafik.
        <ul className={styles.fallbackList}>
          {players.map((p) => (
            <li key={p._id}>
              {p.num} · {shortName(p.name)}
              {p.isBank && <span className={styles.bank}>$</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
