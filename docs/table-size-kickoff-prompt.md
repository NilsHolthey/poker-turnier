# Kickoff-Prompt: Individuelle Tischgrößen + Sitzplätze entfernen

Kontext für Claude Code: Repo `poker-turnier` (Next.js App Router, JS, CSS Modules, MongoDB). Aktuell unterstützt die App nur zwei Tischgrößen (6, 8), global für alle Tische einer Phase einheitlich. Ziel dieses Tickets: Tische können beim Anlegen **einzeln** mit 6, 7 oder 8 Plätzen konfiguriert werden (z. B. 50 Spieler = 2×7 + 6×6), und ein Tisch kann nachträglich **Plätze verlieren** (um während der laufenden Vorrunde wieder Richtung 8×6 zu schrumpfen, sobald Spieler ausgeschieden sind).

**Scope-Hinweis:** Das betrifft aktuell nur den **Einfachen Modus** (`simpleMode`), nicht das volle Balancing/Dissolve der Vorrunde im Normalmodus. `balancing.js`, `dissolve.js` und `seating.js` lesen `table.maxSeats` bereits pro Tisch-Dokument und müssen nicht geändert werden — betroffen sind nur Setup/Erstellung, die Darstellung und eine neue "Platz entfernen"-Aktion.

## 1. Setup: individuelle Tischgröße beim Anlegen

- `components/TournamentSetupForm.js`: globale Felder „Anzahl Tische" + „Plätze pro Tisch" ersetzen durch eine Liste „Tisch hinzufügen" mit Größen-Auswahl (6/7/8) pro Eintrag. State: `tables: [{size: 6}, {size: 7}, ...]` statt `tableCount`/`tableSize`.
- `lib/core/initialSeating.js` → `planInitialSeating()`: Signatur ändern von `{ tableCount, tableSize, sequential }` auf `{ tableSizes: number[], sequential }` (ein Eintrag pro Tisch). Beide Zweige (sequential-Verteilung und random/`pickRandomAmong`) müssen pro Tisch dessen individuelle Kapazität respektieren statt eines globalen `tableSize`.
- `lib/db/tournamentEngine.js` (`createTournament`): beim Insert der Tisch-Dokumente `maxSeats` aus der jeweiligen `tableSizes[i]` setzen statt einheitlich `tableSize`.
- `app/api/tournaments/route.js`: Validierung anpassen — statt einem globalen `tableSize` (2–10) jetzt ein Array von Größen validieren (jede Zahl 6/7/8 laut aktueller Anforderung, Kapazität = Summe ≥ Spieleranzahl).

## 2. Darstellung: 7er-Tisch-Layout

- `lib/client/seatPositions.js`: `SEAT_POSITIONS` hat aktuell nur Keys `6` und `8`. Neuen Eintrag `7` hinzufügen, nach gleicher Geometrie-Logik wie die bestehenden (Kapsel-Form, Sitze entlang der Außennormalen versetzt, Pol-Sitze mit eigenem Kreis-Mittelpunkt). Visuell abstimmen (z. B. 3 pro Längsseite + 1 Pol oben, oder 2+2 pro Seite + 1 Pol unten — ausprobieren, was am Kapsel-Format am saubersten aussieht).
- Alle Konsumenten (`TableCapsule.js`, `MiniTable.js`, `TableList.js`, `ManageTableSheet.js`, `PlayerListBoard.js`) lesen `table.maxSeats` bereits generisch — die müssen NICHT geändert werden, sobald der `7`-Eintrag existiert.
- Eine Lücke dabei beheben: `TableCapsule.js` hat **keinen Fallback**, falls `SEAT_POSITIONS[table.maxSeats]` `undefined` ist (`positions.map(...)` würde crashen). `MiniTable.js` hat dafür schon eine Fallback-Liste (Kommentar „SEAT_POSITIONS kennt nur 6/8"). Sobald `7` ergänzt ist, tritt der Fall nicht mehr auf — trotzdem lohnt sich ein gleichartiger Fallback in `TableCapsule.js`, falls später doch mal eine andere Größe durchrutscht.

## 3. Sitzplätze nachträglich entfernen

- Neue API-Route, z. B. `PATCH app/api/tournaments/[tournamentId]/tables/[tableId]/route.js` (oder dedizierte `.../tables/[tableId]/seats/route.js`): reduziert `maxSeats` eines bestehenden Tisches.
  - Validierung: `neuesMaxSeats >= aktuelle Spielerzahl am Tisch` — sonst 400 mit klarer Fehlermeldung („Erst Spieler umsetzen, bevor der Platz entfernt werden kann").
  - Nur `admin`-Rolle darf das (gleiche Server-seitige Rollenprüfung wie bei anderen Admin-Routen).
- `components/ManageTableSheet.js`: neuer Button „Platz entfernen" pro Tisch, nur aktiv wenn `players.length < table.maxSeats`. Bei Klick: API-Call, danach Tisch-Darstellung (Sitzpositionen) neu rendern mit reduziertem `maxSeats`.

## Nicht in diesem Ticket

- `lib/core/phaseTransition.js` / `endPhase` (Halbfinale/Finale) bleiben unverändert — dort ist eine einheitliche Tischgröße pro Phase weiterhin gewollt (HF/Finale sind laut Plan einheitlich 8er).
- Kein Schema-Change nötig — `tableSchema.maxSeats` erlaubt bereits 2–10.

## Tests

- `lib/core/initialSeating.test.js`: Fälle mit gemischten Tischgrößen (z. B. `[7,7,6,6,6,6,6,6]` für 50 Spieler) ergänzen, inkl. Edge Case „Spieleranzahl passt exakt auf Summe aller Größen" und „zu viele Spieler für die gewählten Größen" (muss Error werfen).
- Neuer Test für die „Platz entfernen"-Route: Ablehnung, wenn Spielerzahl == maxSeats; Erfolg, wenn darunter.
