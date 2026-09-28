# Spiellogik-Referenz

Vollständige Beschreibung der implementierten Turnier-Logik: wie Spieler initial gesetzt werden, wann/wie ausgelost wird, wann Tische aufgelöst/ausgeglichen werden, und was beim Halbfinale-/Finale-Start genau passiert. Quelle der Wahrheit sind die referenzierten Dateien - dieses Dokument ist eine lesbare Zusammenfassung, kein Ersatz für den Code.

## 1. Sitzplatz-Nummerierung

Jeder Spieler hat ein `num`-Feld im Format `"<Tisch-Ordinalzahl>.<Sitz>"`, z.B. `"3.5"` = Tisch 3, Sitz 5.

- `seatOf(num, maxSeats)` liest **nur** den Teil nach dem Punkt und rechnet ihn `mod maxSeats` in einen 0-basierten Sitzindex um. Die Tischnummer im `num`-String beeinflusst die visuelle Position nicht - nur `tableId` bestimmt, an welchem Tisch der Spieler tatsächlich sitzt.
- Das bedeutet: `num` ist im Kern ein Audit-/Anzeige-Label, **nicht** die Quelle der Wahrheit für den Sitzplatz. `tableId` + `seatOf(num)` zusammen ergeben die tatsächliche Position.
- Eindeutigkeit: `{tournamentId, num}` ist unique, aber nur unter aktiven Spielern (`partialFilterExpression: { status: "active" }`, siehe `lib/db/schema.js`). Gebustete Spieler behalten ihre alte `num` als Historie, blockieren aber keinen neuen Spieler auf demselben Platz.

Datei: `lib/core/seating.js`

## 2. Turnier anlegen - initiale Sitzverteilung

Ausgelöst über das Formular auf `/admin` ("Turnier starten" → `TournamentSetupForm`), Funktion `planInitialSeating()`.

- **Erster Spieler in der Liste = Bank**, sitzt immer fest auf `1.1` - kein Zufallsergebnis, unabhängig vom Modus.
- Zwei Modi, umschaltbar per Checkbox "Feste Sitzplätze":
  - **Zufällig (Default):** alle übrigen Spieler werden per Fisher-Yates gemischt, dann Round-Robin auf den jeweils **kleinsten** freien Tisch verteilt (`pickRandomAmong(..., "min")`, Gleichstand wird zufällig aufgelöst).
  - **Sequenziell** (aktiviert durch den "Auf Kapazität auffüllen"-Button, oder manuell zuschaltbar): Spieler i sitzt exakt auf Tisch `floor(i / tableSize) + 1`, Platz `(i % tableSize) + 1` - keine Durchmischung. Der Auto-Fill-Button benennt Spieler passend dazu `"Spieler 1.1"`, `"Spieler 1.2"`, ... und setzt diesen Modus automatisch.
- Wirft einen Fehler, wenn mehr Spieler als Plätze (`tableCount × tableSize`) oder keine Spieler übergeben werden.

Dateien: `lib/core/initialSeating.js`, `components/TournamentSetupForm.js`, `lib/db/tournamentEngine.js` (`createTournament`)

## 3. Laufender Betrieb: Bust-out löst die Auslosungs-Kette aus

Jedes Mal, wenn ein Spieler entfernt wird (Bust-out, `DELETE .../players/:playerId`), läuft serverseitig `resolvePendingAction()`. Das ist eine Schleife (max. 64 Iterationen), die bei **jedem** Aufruf **zuerst Auflösen, dann Ausgleichen** prüft - in dieser festen Reihenfolge, nie umgekehrt:

```
Bust-out
  → resolvePendingAction()
      1. Muss ein Tisch aufgelöst werden? → ja: dissolve-Vorschlag zurückgeben, Schleife verlassen
      2. Sonst: Muss ausgeglichen werden? → ja: balance-Vorschlag zurückgeben, Schleife verlassen
      3. Sonst: null (nichts zu tun)
```

Ein zurückgegebener Vorschlag (`pendingAction`) landet im Client als `DrawDialog` (Rolling-Animation ~1.3s, dann Bestätigungskarte). **Jede Umsetzung braucht eine manuelle Bestätigung** durch den Operator/Admin - nichts passiert automatisch im Hintergrund. Nach jedem bestätigten Zug (`confirmMove` → `applyMove`) wird `resolvePendingAction()` erneut aufgerufen; liefert es einen weiteren Vorschlag, geht die Auslosungskette sofort weiter (nächster `DrawDialog`), bis `null` zurückkommt.

Datei: `lib/db/tournamentEngine.js` (`resolvePendingAction`), `app/api/tournaments/[tournamentId]/players/[playerId]/route.js`

## 4. Auflösen (Dissolve)

**Bedingung** (`findTableToDissolve`):
- Es gibt mehr als 1 aktiven Tisch (ein Tisch wird nie aufgelöst, wenn er der letzte ist).
- Mindestens ein Tisch hat `players.length <= dissolveThreshold` (Default `2`, admin-konfigurierbar).
- Bei mehreren Kandidaten: der/die kleinsten, Gleichstand zufällig aufgelöst.

**Ablauf:**
- Aufgelöst wird **ein Spieler nach dem anderen** vom gewählten Tisch, jeweils an das **aktuell kleinste** verbleibende Ziel (`nextDissolveTarget`, ohne den aufzulösenden Tisch selbst).
- Random-Anteil ist **nur das Ziel**, nicht der Spieler - der nächste zu versetzende Spieler vom auflösenden Tisch steht fest (`dissolveTable.players[0]`).
- "Neu auslosen" (Reroll) zieht nur ein neues Ziel, unter Ausschluss bereits abgelehnter Ziel-IDs für diesen Spieler. Ist kein Ziel mehr übrig, ist "Neu auslosen" deaktiviert ("keine Alternative").
- Ist ein Tisch nach dem letzten aktiven Spieler leer, wird er sofort (ohne Bestätigung) auf `active: false` gesetzt - das ist reine Buchhaltung, kein Auslosungsschritt.
- **UI:** Jeder Auslosungs-Dialog während einer Auflösung zeigt ein rotes "`<Tisch>` wird aufgelöst"-Banner. Sobald der **letzte** Spieler des aufzulösenden Tisches platziert ist, erscheint **ein** zusammenfassendes Popup (`DissolveOverview`) mit alter/neuer Sitznummer aller versetzten Spieler dieser Auflösung - nicht mehr ein Einzel-Popup pro Spieler.
- **Aktiver Tisch:** existiert der zuletzt aktive Tisch danach nicht mehr, wechselt die Ansicht automatisch auf den Zieltisch, statt einen leeren Screen zu zeigen. Das gilt generell: `TournamentBoard` fällt immer auf den ersten noch existierenden Tisch zurück (`activeTableId → myTableId → tables[0]`, erster Treffer, der tatsächlich noch aktiv ist).

Dateien: `lib/core/dissolve.js`, `components/DrawDialog.js`, `components/DissolveOverview.js`, `components/TournamentBoard.js`

## 5. Ausgleichen (Balance)

**Bedingung** (`needsBalance`), nur geprüft, wenn **kein** Dissolve ansteht:
- Mindestens 2 aktive Tische.
- Der kleinste Tisch hat weniger Spieler als `baseline` (Default `4`, admin-konfigurierbar) **und**
- Differenz zwischen größtem und kleinstem Tisch ist `>= balanceDiffThreshold` (Default `2`, admin-konfigurierbar).

**Ablauf:**
- Quelle = größter Tisch, Ziel = kleinster Tisch (`findBalanceTables`, Gleichstand zufällig).
- Der zu versetzende **Spieler** ist der Zufallsanteil (`drawBalanceCandidate`, zufällig unter den noch nicht abgelehnten Kandidaten des Quelltisches) - anders als bei Dissolve, wo der Spieler feststeht und das Ziel zufällig ist.
- "Neu auslosen" zieht einen anderen Spieler vom selben Quelltisch, unter Ausschluss bereits abgelehnter Spieler-IDs. Kein anderer Kandidat mehr → "keine Alternative".
- Auch hier: jede Umsetzung braucht manuelle Bestätigung, kein Auto-Apply.

Datei: `lib/core/balancing.js`

## 6. Bestätigte Umsetzung (`applyMove`)

Bei jedem bestätigten Zug (egal ob Dissolve- oder Balance-Ursprung):
- Der Spieler bekommt eine **neue** `num` am Zieltisch (niedrigster freier Sitz, `nextFreeSeatNum`) - er nimmt seine alte Sitznummer **nicht** mit, weil `seatOf()` sonst zufällig mit einem bereits belegten visuellen Platz kollidieren könnte.
- Ein Eintrag landet in `seatHistory` des Spielers und in der globalen `moves`-Collection (Audit-Log: `fromTableId`, `toTableId`, `reason`, `confirmedBy`, `timestamp`).
- Web-Push geht **gezielt** an Quell- und Zieltisch-Gerät (per Nickname `tischN`, aus dem Tisch-Label abgeleitet) sowie zusätzlich an `admin` (Überblick über jeden Zug an jedem Tisch) - kein Broadcast an alle Geräte.
- Danach läuft `resolvePendingAction()` erneut (siehe Abschnitt 3).

Datei: `lib/db/tournamentEngine.js` (`applyMove`), `lib/server/push.js`

## 7. Rebuy / Spieler hinzufügen

- **Admin:** darf jederzeit Spieler an jedem Tisch hinzufügen.
- **Operator:** darf nur, solange `tournament.config.rebuyPhaseActive === true` (beim Anlegen/Bearbeiten des Turniers gesetzt), und nur am eigenen Tisch (`canManageTable`).
- Tisch muss aktiv und nicht voll sein; die Sitznummer ist entweder der angeklickte leere Kreis (`seatIndex`) oder der niedrigste freie Platz.
- Löst **keine** Dissolve-/Balance-Prüfung aus (nur Bust-outs tun das).

Datei: `app/api/tournaments/[tournamentId]/players/route.js`

## 8. Phasenwechsel (Vorrunde → Halbfinale → Finale)

**Auslöser:** ausschließlich eine explizite Admin-Aktion - der Button in der BottomNav ("HF starten" / "Finale starten"), der `endPhase()` aufruft. Es gibt **keinen** automatischen Phasenwechsel (nicht bei Spielerzahl, nicht bei Zeit).

**Was dabei passiert** (komplett innerhalb einer MongoDB-Transaktion, alles-oder-nichts):
1. Alle aktuell **aktiven** Spieler des Turniers werden geladen (unabhängig davon, an welchem alten Tisch sie sitzen).
2. **Komplette Zufalls-Neuverteilung** - `planPhaseTransition()`: Fisher-Yates-Shuffle aller Spieler, danach Round-Robin auf die neuen Tische (immer der aktuell kleinste zuerst). Es gibt **keine** Auslosung mit Bestätigung wie bei Dissolve/Balance - das ist ein einziger, sofortiger Komplett-Redraw ohne Einzelschritte.
3. Zielstruktur (Tischanzahl/-größe) kommt aus `tournament.phasePlans[nextIndex]`, falls beim Anlegen/Bearbeiten des Turniers gesetzt, sonst Fallback auf die globalen Defaults (`PHASES` in `lib/constants.js`): Halbfinale = 2 Tische × 8 Plätze, Finale = 1 Tisch × 8 Plätze.
4. Neue Tische werden angelegt (`"Halbfinale 1"`, `"Halbfinale 2"`, ...), alle Spieler bekommen eine neue `num` (`1.1`, `1.2`, ... / `2.1`, ...) - **zweiphasig** geschrieben (erst ein garantiert kollisionsfreier Platzhalter `9999.<i>` für alle, dann erst der finale Wert für alle), damit der unique Index `{tournamentId, num}` während der Umnummerierung nie kurzzeitig verletzt wird.
5. Alle Tische der **alten** Phase werden auf `active: false` gesetzt (retired, bleiben aber als Datensatz erhalten).
6. `tournament.phaseIndex` wird auf die neue Phase gesetzt.
7. Für jeden Spieler wird ein `moves`-Eintrag mit `reason: "phaseTransition"` angelegt (Audit-Log).
8. Schlägt irgendein Schritt fehl, rollt die gesamte Transaktion zurück - es kann nie ein halb vollzogener Phasenwechsel (neue Tische ohne passenden `phaseIndex`, oder umgekehrt) im Datenbestand landen.

**Vor dem Klick:** ein Bestätigungsdialog warnt, dass die aktuelle Aufteilung verloren geht und alle Spieler neu verteilt werden.

**Danach:** `activeTableId` wird zurückgesetzt (`null`), damit die Ansicht auf einen der neuen Tische fällt statt auf einen jetzt inaktiven alten.

Dateien: `lib/core/phaseTransition.js`, `lib/db/tournamentEngine.js` (`endPhase`), `lib/constants.js`, `components/BottomNav.js`

## 9. Blind-Uhr

Vier getrennte, admin-only Aktionen - **Speichern startet die Uhr nicht mehr automatisch** (bewusste Entkopplung):

| Aktion | Auslöser | Effekt |
|---|---|---|
| Speichern | "Blindstruktur bearbeiten" → Speichern | Setzt `levels`, `currentLevelIndex: 0`, `currentLevelStartedAt: null` (Uhr läuft NICHT) |
| Starten | "Turnier starten" auf `/admin` | Setzt `currentLevelStartedAt: new Date()` auf dem aktuellen Level, ohne den Index zu ändern |
| Manuell vor/zurück | ◂ ▸ im `BlindPill` (nur während die Uhr läuft) | Setzt `currentLevelIndex` UND `currentLevelStartedAt: new Date()` (Uhr für das neue Level startet bei 0, rechnet nicht rückwirkend) |
| Zurücksetzen | "Timer zurücksetzen" auf `/admin` | Setzt `currentLevelIndex: 0`, `currentLevelStartedAt: null` (Struktur bleibt erhalten, nur die Uhr wird angehalten/genullt) |

**Automatisches Weiterschalten** läuft rein clientseitig, ohne Server-Cron: `computeEffectiveBlindState(schedule, now)` rechnet ausschließlich aus der verstrichenen Zeit seit `currentLevelStartedAt` aus, welches Level gerade gilt (überspringt dabei ggf. mehrere abgelaufene Level auf einmal), und bleibt am letzten Level stehen statt überzulaufen. Ist `currentLevelStartedAt` `null`, liefert die Funktion `started: false` und die volle Dauer des aktuellen Levels als "verbleibend" - die UI zeigt dann "Noch nicht gestartet" statt eines tickenden Countdowns.

Die Pille klappt außerdem von selbst wieder zu: nach 6 Sekunden Inaktivität oder sobald die Seite gescrollt wird.

Datei: `lib/core/blindSchedule.js`, `lib/db/tournamentEngine.js` (`setBlindSchedule`, `startBlindClock`, `setBlindLevelIndex`, `resetBlindClock`), `components/BlindPill.js`

## 10. Konfigurierbare Defaults

Admin-seitig beim Anlegen (`TournamentSetupForm`) oder nachträglich (`TournamentEditForm`, ohne die laufenden Vorrunde-Tische anzufassen) änderbar:

| Feld | Default | Bedeutet |
|---|---|---|
| `baseline` | 4 | Ab welcher Tischgröße ein Tisch als "zu klein" für Balance zählt |
| `dissolveThreshold` | 2 | Tisch wird aufgelöst bei ≤ X Spielern |
| `balanceDiffThreshold` | 2 | Ausgleichen erst, wenn größter/kleinster Tisch sich um mindestens X unterscheiden |
| `rebuyPhaseActive` | true | Ob Operatoren (nicht nur Admin) Spieler hinzufügen dürfen |
| Halbfinale Tische/Plätze | 2 × 8 | Zielstruktur für `endPhase()` bei Index 1 |
| Finale Plätze | 8 (immer 1 Tisch) | Zielstruktur für `endPhase()` bei Index 2 |

Änderungen an diesen Werten lösen **keinen** sofortigen Redraw aus - sie gelten ab dem nächsten Bust-out bzw. dem nächsten `endPhase()`-Aufruf.

Datei: `lib/constants.js`, `lib/db/tournamentEngine.js` (`updateTournamentSettings`)
