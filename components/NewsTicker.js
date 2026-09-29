"use client";

import { createPortal } from "react-dom";
import { useMounted } from "@/lib/client/useMounted";
import styles from "./NewsTicker.module.css";

// Sekunden pro Zeichen statt fester Dauer (Chat-Wunsch: "news flash banner at
// the bottom with moving text") - eine kurze und eine lange Meldung laufen
// so gleich schnell durch, statt dass lange Texte gehetzt wirken oder kurze
// ewig brauchen.
const MS_PER_CHAR = 90;
const MIN_DURATION_S = 14;
// Jedes der zwei Segmente muss für sich schon breiter als der Bildschirm
// sein, sonst reißt die Zwei-Kopien-Endlosschleife (Chat-Bugreport: "text is
// not full width ... only like 55%") - bei einer kurzen Meldung (z.B. nur die
// Füllmeldung, ohne Bust-Zeilen) wiederholt sich der Text deshalb, bis ein
// Segment mindestens so viele Zeichen hat.
const MIN_SEGMENT_CHARS = 400;
// Nur für die Zeichen-Schätzung (Dauer/Wiederholungen) - die eigentliche
// Anzeige nutzt .separator (eigenes, akzentfarbenes Element), nicht diesen
// String direkt.
const SEPARATOR_TEXT = "   ✦   ";

// Nahtlose Dauerschleife: dieselbe (bei Bedarf wiederholte) Meldungsliste
// steht zweimal hintereinander im selben Flex-Track, die Animation verschiebt
// genau um die Breite EINES Segments (-50% der Track-Breite, da Track = 2
// gleich breite Segmente) - sobald das erste Segment komplett durchgelaufen
// ist, steht das zweite exakt an seiner Stelle, kein sichtbarer Sprung.
//
// Trenner ist ein eigenes, akzentfarbenes Element statt eines reinen
// Text-Zeichens (Chat-Wunsch: "cleare spacing or *** or icon or so between
// start and finish") - macht sowohl den Übergang zwischen zwei Meldungen als
// auch die Nahtstelle der Endlosschleife klar erkennbar, statt dass alles
// wie ein einziger durchlaufender Satz wirkt.
function TickerSegment({ items, hidden }) {
  return (
    <span className={styles.segment} aria-hidden={hidden || undefined}>
      {items.map((msg, i) => (
        <span key={i} className={styles.item}>
          <span className={styles.separator} aria-hidden="true">
            ✦
          </span>
          {msg}
        </span>
      ))}
    </span>
  );
}

export default function NewsTicker({ messages }) {
  const mounted = useMounted();

  if (!messages || messages.length === 0 || !mounted) return null;

  const baseLength = messages.join(SEPARATOR_TEXT).length;
  const repeatCount = Math.max(1, Math.ceil(MIN_SEGMENT_CHARS / baseLength));
  const items = Array.from({ length: repeatCount }, () => messages).flat();
  const durationS = Math.max(MIN_DURATION_S, (items.join(SEPARATOR_TEXT).length * MS_PER_CHAR) / 1000);

  // Portal nach document.body statt normaler Kind-Position (Chat-Bugreport:
  // "bottom gradient making it hard to read also not using the full width")
  // - DashboardBoard.module.css .page hat eine content-fade-in-Animation, die
  // während ihrer Laufzeit `transform` setzt. Ein transform auf einem
  // Vorfahren wird zum containing block für ALLE position:fixed-Nachfahren
  // (dieselbe Bug-Klasse wie bei Toast.js/BlindPill.js) - der Ticker
  // positionierte sich dadurch relativ zu .page (inkl. dessen Padding, daher
  // "nicht volle Breite") statt zum echten Viewport, und lag unter dem
  // global-fixed .fadeBottom aus app/layout.js statt darüber.
  return createPortal(
    <div className={styles.ticker} role="status" aria-live="polite">
      <span className={styles.tag}>LIVE</span>
      <div className={styles.viewport}>
        <div className={styles.track} style={{ animationDuration: `${durationS}s` }}>
          <TickerSegment items={items} />
          <TickerSegment items={items} hidden />
        </div>
      </div>
    </div>,
    document.body
  );
}
