"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import MiniTable from "./MiniTable";
import NewsTicker from "./NewsTicker";
import { fetchDashboardState } from "@/lib/client/api";
import {
  formatBlindLevel,
  computeEffectiveBlindState,
  computeLevelStartTimes,
  isRebuyPhaseActive,
  rebuyRemainingMs,
  tableOrdinalFromLabel,
} from "@/lib/core";
import { PHASES } from "@/lib/constants";
import { shortName } from "@/lib/client/formatName";
import { pickTauntSentence } from "@/lib/client/tauntSentences";
import styles from "./DashboardBoard.module.css";

// Wie lange ein Bust in der Ticker-Zeile bleibt, bevor er rausrotiert (Chat:
// "news flash banner ... when a player busts it should show player xy
// busted"). Länger als das rote Highlight in der Spielerliste (6s), damit
// die Meldung auch bei laufendem Ticker-Text wirklich gelesen werden kann.
const BUST_TICKER_MS = 60000;

// Schneller als das normale 8s-Polling im Live-Board (TournamentBoard.js) -
// hier sitzt niemand, der einen Fehler manuell korrigieren könnte, das
// Dashboard soll einfach zügig nachziehen. Bewusst Polling statt Push (Chat:
// "receive push ... but not show as popup") - Push ohne showNotification()
// lässt Chrome/Android nach ein paar "stillen" Zustellungen die
// Benachrichtigungs-Berechtigung für die GESAMTE Origin automatisch
// widerrufen (derselbe Service Worker bedient auch die Tisch-Operatoren) -
// Polling erreicht dasselbe "zieht von selbst nach" ganz ohne dieses Risiko.
const POLL_MS = 4000;

// mm:ss statt hh:mm:ss (Chat-Wunsch: "for remaining time of blind level mm:ss
// is fine no need for hh since they are usually only 60 or 30 min") - ein
// Blind-Level dauert nie eine Stunde oder länger, die führende "00:"-Stunde
// wäre nur totes Gewicht.
function formatHMS(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatHM(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  // "h"-Suffix (Chat-Wunsch: "we should add an H so we know unit") - ohne
  // Einheit liest sich "1:23" leicht wie mm:ss statt hh:mm, gerade neben
  // der Blind-Restzeit (formatHMS), die im selben mm:ss-Look daherkommt.
  // Stunden ohne führende Null (Chat: "never gonna be 10h") - Rebuy-Phasen
  // sind nie so lang, dass zweistellige Stunden vorkämen.
  return `${hours}:${String(minutes).padStart(2, "0")}h`;
}

// Handverlesene, symmetrische Zeilenaufteilung statt frei umbrechendem Grid
// (Chat: "I want them to be more symetrical ... 8 -> 3 2 3, 7 -> 2 3 2, ...").
// Kein einzelnes Formelmuster über alle Zahlen hinweg - bewusst pro Anzahl
// die vom Chat vorgegebene Aufteilung, nicht selbst "optimiert".
const TABLE_ROW_LAYOUTS = {
  1: [1],
  2: [2],
  3: [3],
  4: [2, 2],
  5: [2, 1, 2],
  6: [3, 3],
  7: [2, 3, 2],
  8: [3, 2, 3],
};

function chunkTablesIntoRows(tables) {
  const layout = TABLE_ROW_LAYOUTS[tables.length];
  if (layout) {
    const rows = [];
    let offset = 0;
    for (const count of layout) {
      rows.push(tables.slice(offset, offset + count));
      offset += count;
    }
    return rows;
  }
  // Fallback für Tischzahlen jenseits der Spec-Beispiele (>8, kommt bei den
  // üblichen Tischgrößen/Spielerzahlen dieser App praktisch nicht vor) -
  // einfaches Auffüllen in Dreier-Reihen statt eines Absturzes.
  const rows = [];
  for (let i = 0; i < tables.length; i += 3) rows.push(tables.slice(i, i + 3));
  return rows;
}

// Bugreport (Screenshot, 1180x820-Testviewport): die reine CSS-Lösung
// (Kapsel-Höhe in %, Breite per aspect-ratio abgeleitet) hat die Kapsel bei
// 3 Zeilen praktisch auf 0 kollabieren lassen - Sitzplätze (SEAT_POSITIONS)
// sind position:absolute und zählen NICHT zur Eigengröße ihres Containers,
// wenn aspect-ratio+%-Höhe in dieser Verschachtelung nicht zuverlässig
// auflöst, hat die Kapsel keine Breite und alle Sitze kollabieren auf denselben
// Punkt. Chat-Entscheidung: "iPad Air 11 (1180x820) ist unsere feste
// Zielgröße" - deshalb jetzt in JS aus der TATSÄCHLICH gemessenen
// .tablesArea-Box (ResizeObserver, kein geratener CSS-Wert) eine explizite
// Pixelgröße berechnen, die BEIDE Grenzen einhält (Zeilenhöhe UND
// Tischbreite pro Zeile) und als CSS-Variable an MiniTable durchreicht -
// keine Prozent-/aspect-ratio-Auflösung mehr nötig, die querschießen könnte.
const CAPSULE_ASPECT = 0.6; // Breite/Höhe, 3:5 wie TableCapsule
const ROWS_GAP = 20; // muss zu .tablesArea gap passen (DashboardBoard.module.css)
const ROW_GAP = 12; // muss zu .tableRow gap passen (Standardwert, siehe HF_ROW_GAP unten)
// Chat-Wunsch: "more spacing between the tables" auf HF - eigener, größerer
// Gap-Wert nur für diese Phase statt den globalen ROW_GAP zu ändern. Wird
// unten sowohl in computeCapsuleSize (Breiten-Budget) ALS AUCH als
// tatsächlicher CSS-gap auf .tableRow verwendet, damit Rechnung und
// Darstellung übereinstimmen (dieselbe Kopplung wie ROW_GAP/.tableRow gap).
const HF_ROW_GAP = 60;
const LABEL_RESERVE = 22; // px für Tischname über der Kapsel
const VERTICAL_SEAT_BUFFER = 34; // px Puffer über/unter der Kapsel für oben/unten überstehende Sitze
const LATERAL_OVERFLOW_FACTOR = 1.3; // Kapselbreite * Faktor = Platzbedarf inkl. seitlich überstehender Sitze

// scale (Chat-Wunsch: "make the table and seats etc smaller on hf on
// dashboard, by a third") - HF hat per Default nur 2 Tische in 1 Zeile, die
// normale "weniger Tische = mehr Platz pro Tisch"-Logik oben macht sie
// dadurch schon von selbst größer als in der Vorrunde; skaliert hier gezielt
// wieder runter, statt die Kernformel für alle Phasen zu verändern.
// rowGap parametrisiert statt fest ROW_GAP (siehe HF_ROW_GAP oben).
function computeCapsuleSize(tablesAreaSize, rowCount, maxRowLen, scale = 1, rowGap = ROW_GAP) {
  if (!tablesAreaSize || !tablesAreaSize.width || !tablesAreaSize.height || !rowCount || !maxRowLen) return null;

  const rowHeight = (tablesAreaSize.height - (rowCount - 1) * ROWS_GAP) / rowCount;
  const heightBudget = Math.max(28, rowHeight - LABEL_RESERVE - VERTICAL_SEAT_BUFFER);

  const perTableWidth = (tablesAreaSize.width - (maxRowLen - 1) * rowGap) / maxRowLen;
  const widthBudget = Math.max(20, perTableWidth / LATERAL_OVERFLOW_FACTOR);

  const heightFromWidthBudget = widthBudget / CAPSULE_ASPECT;
  const capsuleHeight = Math.min(heightBudget, heightFromWidthBudget) * scale;
  const capsuleWidth = capsuleHeight * CAPSULE_ASPECT;

  // slotWidth statt nur capsuleWidth an den Wrapper geben (Bugfix: die
  // capsuleWidth ist ABSICHTLICH kleiner als perTableWidth gerechnet, um
  // seitlich überstehenden Sitzen Platz zu lassen (LATERAL_OVERFLOW_FACTOR) -
  // das ist aber nur Kopfrechnung, solange nicht auch der WRAPPER selbst
  // diese Breite tatsächlich einnimmt. Ohne das würde der Wrapper nur so
  // breit wie die (bewusst verkleinerte) Kapsel, der "reservierte" Rest
  // existiert nirgends im echten Layout und die Sitze überlappen den
  // Nachbartisch trotzdem. Auch slotWidth wird mit skaliert, damit der
  // kleinere Tisch nicht in einem gleich großen (jetzt zu großen) Slot mit
  // viel Leerraum drumherum landet.
  return {
    width: Math.round(capsuleWidth),
    height: Math.round(capsuleHeight),
    slotWidth: Math.round(perTableWidth * scale),
  };
}

// Chat-Wunsch: "we need to bring back the full screen option. but this time
// if we double click in a certain space" - kein sichtbarer Button mehr (der
// war für die PWA-auf-iPad-Idee gedacht, siehe frühere Kommentare unten),
// stattdessen Doppelklick irgendwo auf der sonst komplett passiven/nicht
// interaktiven Dashboard-Fläche. Browser verlangen für die Fullscreen-API
// eine echte Nutzergeste - ein Doppelklick zählt dafür, ein programmatischer
// Aufruf beim Laden nicht.
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

// Chat-Wunsch: "if I toggle to fullscreen I want the cursor to disappear
// after 3 sec" - nur in Fullscreen relevant, nicht im normalen Browserfenster
// (da würde ein verschwindender Mauszeiger beim Admin-Arbeiten nur stören).
const CURSOR_IDLE_MS = 3000;

export default function DashboardBoard({ tournamentId, initialState }) {
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const tablesAreaRef = useRef(null);
  const [tablesAreaSize, setTablesAreaSize] = useState(null);

  // fullscreenchange statt nur im onDoubleClick-Handler selbst zu tracken -
  // deckt auch ein Verlassen per Esc/Fernbedienung ab, nicht nur den erneuten
  // Doppelklick.
  useEffect(() => {
    function handleFullscreenChange() {
      setFullscreen(!!document.fullscreenElement);
      // Beim Verlassen sofort wieder sichtbar statt bis zur nächsten
      // Mausbewegung versteckt zu bleiben.
      setCursorHidden(false);
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Versteckt den Mauszeiger nach CURSOR_IDLE_MS Inaktivität, nur während
  // Fullscreen - jede Mausbewegung zeigt ihn sofort wieder und setzt den
  // Timer zurück (klassisches Kiosk-/Player-Verhalten).
  useEffect(() => {
    if (!fullscreen) return;
    let timer = setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    function handleMouseMove() {
      setCursorHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    }
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(timer);
    };
  }, [fullscreen]);

  // Misst die ECHTE verfügbare Fläche statt CSS-Prozentwerte zu erraten
  // (siehe computeCapsuleSize oben) - läuft bei jeder Größenänderung neu
  // (Fenster-Resize, Vollbild-Wechsel), useLayoutEffect statt useEffect, damit
  // die erste Messung schon vor dem ersten sichtbaren Paint steht.
  useLayoutEffect(() => {
    const el = tablesAreaRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setTablesAreaSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardState(tournamentId).then(setState).catch(() => {});
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [tournamentId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { tournament, tables, players } = state;
  const schedule = tournament.blindSchedule;
  const effective = schedule ? computeEffectiveBlindState(schedule, now) : null;
  const levelStartTimes = schedule ? computeLevelStartTimes(schedule) : [];
  const nextLevel = schedule && effective ? schedule.levels[effective.effectiveIndex + 1] ?? null : null;
  const rebuyActive = isRebuyPhaseActive(tournament.config, schedule, now);
  const rebuyRemaining = rebuyRemainingMs(tournament.config, schedule, now);
  // Chat-Wunsch: "total tournament clock" - firstStartedAt wird nur beim
  // allerersten startBlindClock() gesetzt und bleibt über Levelwechsel/Pausen
  // hinweg stehen (siehe tournamentEngine.js), anders als currentLevelStartedAt.
  const tournamentElapsedMs = schedule?.firstStartedAt ? now - new Date(schedule.firstStartedAt).getTime() : null;

  const sortedTables = [...tables].sort((a, b) => a.label.localeCompare(b.label, "de"));
  const tableRows = chunkTablesIntoRows(sortedTables);
  const tableById = new Map(tables.map((t) => [t._id, t]));

  // Kurzes rotes Aufblitzen für frisch gebustete Spieler, rein zeitbasiert aus
  // bustedAt statt Client-seitigem Poll-Diffing - funktioniert dadurch auch
  // direkt nach einem Seitenreload korrekt.
  const JUST_BUSTED_MS = 6000;
  function isJustBusted(player) {
    return player.status !== "active" && player.bustedAt && now - new Date(player.bustedAt).getTime() < JUST_BUSTED_MS;
  }
  // Erst nach der Highlight-Phase ans Ende verschieben (Chat-Wunsch: "the
  // highlighting needs to happen before the resorting and appending") - ein
  // frisch gebusteter Spieler bleibt für JUST_BUSTED_MS an seinem
  // ursprünglichen Platz (rot markiert) stehen, statt sofort ans Listenende
  // zu springen, und wandert erst danach in den gebusteten Abschnitt.
  function isSettledBusted(player) {
    return player.status !== "active" && !isJustBusted(player);
  }

  // Nur "wirklich" aktive Spieler (nicht die frisch gebusteten, die für den
  // Moment noch mitlaufen) zählen für Sitzplätze/"Spieler übrig" - ein
  // gebusteter Spieler sitzt trotz Highlight-Phase nicht mehr am Tisch.
  const activePlayers = players.filter((p) => p.status === "active");
  // Für die Liste zählt "an der ursprünglichen Stelle" zusätzlich die
  // Highlight-Phase mit dazu, damit genau die rot markierte Zeile dort
  // erscheint, wo der Spieler vorher stand (nicht schon am Ende).
  const rosterInPlacePlayers = players.filter((p) => p.status === "active" || isJustBusted(p));
  const sortedInPlacePlayers = [...rosterInPlacePlayers].sort((a, b) => {
    const labelA = tableById.get(a.tableId)?.label ?? "";
    const labelB = tableById.get(b.tableId)?.label ?? "";
    if (labelA !== labelB) return labelA.localeCompare(labelB, "de");
    return a.num.localeCompare(b.num, "de", { numeric: true });
  });
  // Gebustete Spieler bleiben sichtbar statt zu verschwinden (Chat-Wunsch:
  // "the list should not shrink ... get appended at the end greyed out") -
  // nach bustedAt sortiert, damit wer zuerst raus ist auch zuerst im
  // gebusteten Abschnitt steht und neue Busts am Ende landen. Fehlt
  // bustedAt (Datensätze von vor diesem Feld), zählt das wie "ganz früh
  // gebustet" statt den Rest der Sortierung zu stören.
  const settledBustedPlayers = players
    .filter((p) => isSettledBusted(p))
    .sort((a, b) => new Date(a.bustedAt ?? 0).getTime() - new Date(b.bustedAt ?? 0).getTime());
  const sortedPlayers = [...sortedInPlacePlayers, ...settledBustedPlayers];

  // News-Ticker-Meldungen (Chat-Wunsch: "news flash banner at the bottom
  // with moving text"), in Anzeige-Reihenfolge:
  // 1. Turnier konfiguriert, aber Blind-Uhr noch nicht gestartet.
  // 2. Kürzliche Busts, je mit einem zur verbleibenden Spielerzahl
  //    passenden Taunting-Satz (lib/client/tauntSentences.js).
  // 3. Eine allgemeine "X Spieler kämpfen noch"-Füllmeldung, damit der
  //    Ticker nie ganz leer/leise wird.
  const tickerMessages = [];
  if (!schedule) {
    // Turnier existiert (sonst wäre man gar nicht auf dieser Seite), aber es
    // wurde noch keine Blindstruktur hinterlegt - kein startTime bekannt.
    tickerMessages.push("Turnier noch nicht gestartet - noch keine Blindstruktur hinterlegt");
  } else if (effective && !effective.started) {
    tickerMessages.push(`Turnier noch nicht gestartet - startet um ${schedule.startTime} Uhr`);
  }
  // Chat-Wunsch: "last bust plus sentence should stay ... it should not
  // jump back to only the players fighting" - bustedPlayers/recentBusts wie
  // vorher (alle Busts der letzten BUST_TICKER_MS zeigen), ABER der zuletzt
  // gebustete Spieler bleibt danach trotzdem in der Rotation, statt nach
  // Ablauf des 60s-Fensters ganz zu verschwinden und den Ticker auf die
  // reine "X kämpfen noch"-Füllmeldung zurückfallen zu lassen, sobald mal
  // eine Weile niemand mehr aussteigt.
  const bustedPlayers = players
    .filter((p) => p.status !== "active" && p.bustedAt)
    .sort((a, b) => new Date(b.bustedAt).getTime() - new Date(a.bustedAt).getTime());
  const recentBusts = bustedPlayers.filter((p) => now - new Date(p.bustedAt).getTime() < BUST_TICKER_MS);
  const bustsToShow = recentBusts.length > 0 ? recentBusts : bustedPlayers.slice(0, 1);
  for (const p of bustsToShow) {
    const taunt = pickTauntSentence(activePlayers.length, p._id);
    tickerMessages.push(`${p.name} wurde gebustet! ${taunt}`);
  }
  // Chat-Wunsch: "some kind of highlight on the news banner if a player
  // busts" - dieselbe JUST_BUSTED_MS-Zeitspanne wie das rote Aufblitzen in
  // der Spielerliste (siehe isJustBusted oben), damit beide Effekte
  // synchron ablaufen statt unabhängig verschieden lang zu laufen.
  const tickerJustBusted = bustedPlayers.length > 0 && now - new Date(bustedPlayers[0].bustedAt).getTime() < JUST_BUSTED_MS;
  // Nur zeigen, wenn die Blind-Uhr wirklich läuft (Chat-Wunsch: "the players
  // fighting part only after tournament started") - vorher steht ja schon
  // die "Turnier noch nicht gestartet"-Meldung oben.
  if (effective?.started && activePlayers.length > 0) {
    tickerMessages.push(`${activePlayers.length} Spieler kämpfen noch um die Plätze`);
  }

  // phaseIndex 2 = PHASES[2] = Finale (siehe lib/constants.js) - einmal hier
  // auf Komponentenebene statt lokal in der Tische-IIFE unten, wird jetzt
  // auch für den abgedunkelten Hintergrund gebraucht (Chat-Wunsch: "if final
  // table is reached ... background gets slightly darker and the table
  // should get a golden glow").
  const isFinale = tournament.phaseIndex === 2;

  return (
    // Kein <header> mehr (Chat: "remove the header for now, we do not need a
    // title or a full screen button, we will open as PWA and AirPlay from
    // iPad" - dieser Plan ist inzwischen verworfen, siehe toggleFullscreen
    // oben: Vollbild kommt jetzt per Doppelklick zurück statt über einen
    // eigenen sichtbaren Button, der Rest (kein Titel/Header) bleibt aber so,
    // passt weiterhin zum bewusst chromfreien TV-Look).
    <main
      className={`${styles.page} ${isFinale ? styles.pageFinale : ""} ${cursorHidden ? styles.cursorHidden : ""}`}
      onDoubleClick={toggleFullscreen}
    >
      {/* Chat-Wunsch: "player list on the left side, blindes on the right
          side" - Tische bleiben in der Mitte als Hauptfläche, die beiden
          Listen rahmen sie links/rechts statt zusammen in einer Sidebar zu
          stecken. */}
      <div className={styles.body}>
        <div className={styles.leftColumn}>
          <section className={`${styles.panel} ${styles.playerPanel}`}>
            <h2 className={styles.panelTitle}>Spieler ({activePlayers.length})</h2>
            <div className={styles.playerList}>
              {sortedPlayers.map((p) => {
                const busted = isSettledBusted(p);
                return (
                  <div
                    key={p._id}
                    className={`${styles.playerRow} ${busted ? styles.playerBusted : ""} ${
                      isJustBusted(p) ? styles.playerJustBusted : ""
                    }`}
                  >
                    <span className={styles.playerTable} style={{ color: tableById.get(p.tableId)?.color }}>
                      {tableById.get(p.tableId) ? tableOrdinalFromLabel(tableById.get(p.tableId).label) : "-"}
                    </span>
                    <span className={styles.playerName}>
                      {shortName(p.name)}
                      {p.isBank && <span className={styles.playerBank}>$</span>}
                    </span>
                    {/* Chat-Wunsch: "add the seat number so its easier to
                        find your spot, right side of the pill" / "but only
                        for active players" - ein gebusteter Spieler sitzt an
                        keinem Platz mehr, p.num bliebe sonst der zuletzt
                        belegte (und evtl. inzwischen von jemand anderem
                        besetzte) Platz. */}
                    {!busted && (
                      <span className={styles.playerSeat} style={{ color: tableById.get(p.tableId)?.color }}>
                        {p.num}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Chat-Wunsch: "bottom left ... info about players left but
              bigger so directly visible also from further away. which
              phase. if rebuy for how long only hh:mm" - füllt den Platz, der
              seit der festen .playerPanel-Höhe übrig ist. */}
          <section className={`${styles.panel} ${styles.statsPanel}`}>
            <div className={styles.bigStat}>
              <span className={`${styles.bigStatValue} ${styles.playerCountValue}`}>{activePlayers.length}</span>
              <span className={styles.bigStatLabel}>Spieler übrig</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Phase</span>
              <span className={styles.infoValue}>{PHASES[tournament.phaseIndex].name}</span>
            </div>
            <div className={`${styles.infoRow} ${rebuyActive ? styles.rebuyOn : styles.rebuyOff}`}>
              <span className={styles.infoLabel}>{rebuyActive ? "Rebuy noch" : "Rebuy"}</span>
              <span className={styles.infoValue}>
                {rebuyActive ? (rebuyRemaining != null ? formatHM(rebuyRemaining) : "aktiv") : "vorbei"}
              </span>
            </div>
          </section>
        </div>

        {/* --row-count: teilt .tablesArea per CSS-Grid in gleich große Zeilen.
            --row-width-ratio pro Zeile (Chat: "the middle row ... tables
            should exactly sit between the others so it's symmetrical"):
            eine Reihe mit weniger Tischen als die längste Reihe des Layouts
            wird schmaler + zentriert, ihre Tische landen dadurch an den
            gleichen Bruchteils-Positionen wie die der vollen Reihen. */}
        <div ref={tablesAreaRef} className={styles.tablesArea} style={{ "--row-count": tableRows.length }}>
          {(() => {
            const maxRowLen = Math.max(...tableRows.map((r) => r.length));
            // Chat-Wunsch: "make the table and seats etc smaller on hf on
            // dashboard, by a third ... also the player circles and more
            // spacing between the tables" / "final table needs to be shrunk
            // in size by 50%" - phaseIndex 1 = PHASES[1] = Halbfinale.
            // isFinale kommt jetzt von Komponentenebene oben.
            const isHf = tournament.phaseIndex === 1;
            // Chat-Wunsch: "reduce the table size minimal" - 0.9 statt 1 als
            // Vorrunde-Default (HF/Finale-Werte bleiben eigene, unabhängige
            // Multiplikatoren, nicht relativ zu diesem).
            const capsuleScale = isHf ? 2 / 3 : isFinale ? 0.5 : 0.9;
            const rowGap = isHf ? HF_ROW_GAP : ROW_GAP;
            const capsuleSize = computeCapsuleSize(tablesAreaSize, tableRows.length, maxRowLen, capsuleScale, rowGap);
            return tableRows.map((rowTables, i) => (
              <div
                key={i}
                className={styles.tableRow}
                style={{ "--row-width-ratio": rowTables.length / maxRowLen, gap: `${rowGap}px` }}
              >
                {rowTables.map((table) => (
                  <MiniTable
                    key={table._id}
                    table={table}
                    players={activePlayers.filter((p) => p.tableId === table._id)}
                    active={table.active}
                    capsuleSize={capsuleSize}
                    scale={capsuleScale}
                    finale={isFinale}
                  />
                ))}
              </div>
            ));
          })()}
        </div>

        <div className={styles.rightColumn}>
          <section className={`${styles.panel} ${styles.blindPanel}`}>
            <h2 className={styles.panelTitle}>Blindstruktur</h2>
            {!schedule ? (
              <p className={styles.empty}>Noch keine Blindstruktur hinterlegt.</p>
            ) : (
              // Echte <table> statt Grid-Zeilen (Chat-Wunsch: "make it a
              // propper table so everything is aligned") - in einer Spalte
              // bekommen alle Zellen dieselbe Breite, dadurch stehen
              // Level-Wert/Dauer/Uhrzeit in jeder Zeile exakt untereinander,
              // unabhängig vom jeweiligen Textinhalt (gleiches Prinzip wie
              // bei der Sitzplan-Druckansicht, app/players/print/page.js).
              <table className={styles.blindList}>
                <tbody>
                  {schedule.levels.map((level, i) => {
                    // Chat-Wunsch: "break is highlighted in one color, rebuy
                    // phase should be greenish background so we can see
                    // directly from the blindes which phase" - Rebuy gilt nur
                    // mit gesetztem automatischem Ende (rebuyEndLevelIndex);
                    // ohne das lässt sich pro Level nicht sagen, ob Rebuy dort
                    // noch laufen würde (nur der manuelle Schalter zählt dann).
                    const isRebuyLevel =
                      !!tournament.config.rebuyPhaseActive &&
                      schedule.rebuyEndLevelIndex != null &&
                      i < schedule.rebuyEndLevelIndex;
                    return (
                      <tr
                        key={i}
                        // Chat-Wunsch: "for the rest ... like on players list
                        // that every nth cell is different" - gleiches
                        // Streifen-Muster wie .playerRow:nth-child(odd), hier
                        // aber als eigene Klasse statt :nth-child, damit die
                        // Cascade-Reihenfolge in der CSS-Datei (nicht die
                        // DOM-Position) entscheidet, wer bei Kombination mit
                        // Rebuy/Pause/aktuellem Level gewinnt.
                        className={`${styles.blindRow} ${i % 2 === 1 ? styles.blindRowAlt : ""} ${
                          isRebuyLevel ? styles.blindRowRebuy : ""
                        } ${level.isBreak ? styles.blindRowBreak : ""} ${
                          i === effective.effectiveIndex ? styles.blindRowCurrent : ""
                        }`}
                      >
                        <td className={styles.blindIndex}>{i + 1}</td>
                        <td className={styles.blindLevelValue}>{formatBlindLevel(level)}</td>
                        <td className={styles.blindDuration}>{level.durationMinutes}m</td>
                        <td className={styles.blindTime}>{levelStartTimes[i]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {/* Chat-Wunsch: "bottom right we add bigger info of the current
              blinde, next blindes and time left ... hh:mm:ss and remove the
              top pill we currently have". */}
          {effective && (
            <section className={`${styles.panel} ${styles.blindNowPanel}`}>
              <div className={styles.bigStat}>
                <span className={styles.bigStatValue}>{formatBlindLevel(effective.level)}</span>
                <span className={styles.bigStatLabel}>Aktuelles Level</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Nächstes</span>
                <span className={styles.infoValue}>{nextLevel ? formatBlindLevel(nextLevel) : "Ende"}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>{effective.paused ? "Pausiert bei" : "Verbleibend"}</span>
                <span className={`${styles.infoValue} ${effective.paused ? styles.infoValuePaused : ""}`}>
                  {effective.started ? formatHMS(effective.remainingMs) : "--:--"}
                </span>
              </div>
              {/* Chat-Wunsch: "total tournament clock" - Gesamtlaufzeit statt
                  nur der Level-Restzeit, eigene Zeile statt eigenes Panel, da
                  im blindNowPanel noch Platz war. */}
              {tournamentElapsedMs != null && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Turnier läuft seit</span>
                  <span className={styles.infoValue}>{formatHM(tournamentElapsedMs)}</span>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <NewsTicker messages={tickerMessages} alert={tickerJustBusted} />
    </main>
  );
}
