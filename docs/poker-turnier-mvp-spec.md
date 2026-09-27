# Poker-Turnier Tisch-Management – MVP-Spezifikation

Web-App/PWA zur Live-Verwaltung eines Freundes-Pokerturniers (max. 48 Spieler). Ersetzt manuelles Tisch-Balancing durch ein System, das laufend prüft, wie viele Spieler an welchem Tisch verbleiben, und bei Bedarf zufällig Spieler umsetzt oder Tische auflöst.

## Tech-Stack

- **Next.js** (App Router) – **JavaScript, kein TypeScript** (`.js`/`.jsx`)
- React (function components, hooks – kein Class-Component-Zwang wie im Foxxum/TV-Umfeld)
- CSS Modules (`.module.scss` oder `.module.css`)
- MongoDB
- PWA via `next-pwa` (Manifest + Service Worker)
- Auth0 (`@auth0/nextjs-auth0`, aktuell v4) für Login

## Turnier-Struktur

- 48 Spieler max., Start: 8 Tische à 6 Spieler
- Vorrunde → Halbfinale (2 Tische à 8) → Finale (1 Tisch à 8)
- Phasen sind admin-getriggert, nicht automatisch

```js
const PHASES = [
  { name: "Vorrunde",    targetTables: 8, tableSize: 6 },
  { name: "Halbfinale",  targetTables: 2, tableSize: 8 },
  { name: "Finale",      targetTables: 1, tableSize: 8 },
];
```

## Datenmodell (MongoDB)

```
tournaments
  _id, name, phaseIndex, config: { baseline, dissolveThreshold, rebuyPhaseActive },
  createdAt

tables
  _id, tournamentId, phaseIndex, label ("Tisch 1" / "Halbfinale 1"),
  color (hex, aus fester 8er-Palette), maxSeats (6 oder 8), active: bool

players
  _id, tournamentId, tableId, num ("1.3"), name, isBank: bool,
  status ('active' | 'busted' | 'advanced'),
  seatHistory: [{ tableId, timestamp, reason }]

moves   // Audit-Log
  _id, tournamentId, playerId, fromTableId (nullable, bei Auflösung), toTableId,
  reason ('balance' | 'dissolve' | 'phaseTransition' | 'manual'), confirmedBy, timestamp
```

**Sitzplatz-Zuordnung:** `num` bestimmt den festen Sitzplatz über `seatOf(num, maxSeats) = (num.split(".")[1] - 1) % maxSeats`. Damit rutschen Sitzplätze beim Entfernen/Hinzufügen nicht durcheinander (Position ist an die Nummer gebunden, nicht an die Array-Reihenfolge).

**Sitzreihenfolge im Uhrzeigersinn, Start unten links:**
- 6er-Tisch: unten-links → mitte-links → oben-links → oben-rechts → mitte-rechts → unten-rechts
- 8er-Tisch (HF/Finale): zusätzlich **Kopfende** (nach oben-links) und **Fußende** (nach unten-rechts, schließt den Kreis)

## Rollenmodell (Auth0)

Zwei Rollen, flach über `app_metadata`:

```json
{ "role": "admin" | "operator" }
```

- **admin**: Turnierstruktur, Phasenübergänge, Rebuy-Phase beenden, überall korrigieren
- **operator**: darf nur am **eigenen** Tisch Spieler hinzufügen/entfernen/umbenennen/umsetzen

**Update (siehe Chat):** ursprünglich war hier kein `tableIds`-Scoping vorgesehen (jeder Operator durfte überall verwalten, "Mein Tisch" war nur ein Bookmark). Das wurde revidiert, weil ohne Einschränkung jeder Operator-Account an jedem Tisch Spieler umbenennen/entfernen konnte – ein klarer Abuse-Vektor bei einem Freundesturnier ("Spieler benennen andere zum Spaß um"). **Ein Operator-Account pro Tisch** (8 Accounts) bestimmt jetzt nicht mehr nur das "Mein Tisch"-Bookmark, sondern auch direkt die Berechtigung: durchgesetzt serverseitig in jeder Roster-verändernden Route über `lib/authz.js` `canManageTable()` (Ziffernabgleich Nickname ↔ `tableOrdinalFromLabel(table.label)`, admin ausgenommen).

Custom Claims (`role`) müssen per Auth0 Action in Session/ID-Token injiziert werden – passiert nicht automatisch.

## Kern-Algorithmus: Tisch-Balancing

Läuft nach jedem "Spieler entfernen"-Event, in dieser Reihenfolge:

### 1. Auflösungs-Check (zuerst!)

```js
DISSOLVE_THRESHOLD = 2  // konfigurierbar

Gibt es einen Tisch mit players.length <= DISSOLVE_THRESHOLD
UND gibt es mehr als 1 aktiven Tisch?
→ dissolveTable(tableId)
```

`dissolveTable`:
- Tisch wird komplett aus der aktiven Liste entfernt
- Alle verbleibenden Spieler werden **greedy** verteilt: nacheinander an den jeweils *aktuell kleinsten* verbleibenden Tisch
- Ist die Bank unter den Verteilten → Accept/Reroll-Dialog, aber hier wird **das Zieltisch neu ausgelost**, nicht die Person (die Person steht fest)

### 2. Normales Balancing (nur wenn kein Auflösungsfall)

```js
BASELINE = 4  // konfigurierbar

if (min(tableSizes) < BASELINE && max(tableSizes) - min(tableSizes) >= 2) {
  fromTable = Tisch mit den meisten Spielern
  toTable   = Tisch mit den wenigsten Spielern
  → Zufälliger Spieler von fromTable wird nach toTable ausgelost
}
```

**⚠️ Bekannter Bug, der im Build gefixt werden muss:** `.find()`/`.sort()` bei Gleichstand nimmt aktuell immer das erste Element in Array-Reihenfolge (= niedrigste Tisch-Nummer). Das führt dazu, dass bei mehreren gleich großen Tischen strukturell immer derselbe Tisch bevorzugt wird. Fix: bei Gleichstand zufällig unter den Kandidaten wählen:

```js
function pickRandomAmong(tablesArr, extractValue, mode) {
  const target = mode === "max"
    ? Math.max(...tablesArr.map(extractValue))
    : Math.min(...tablesArr.map(extractValue));
  const candidates = tablesArr.filter((t) => extractValue(t) === target);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```
Gilt für `checkBalance`, `dissolveTable` und `endPhase` gleichermaßen.

### 3. Auslosung: UX-Ablauf

1. **Rolling-Animation** (~1,3s): Würfel-Icon rotiert, Spielernummern laufen durch den Kandidatenpool
2. **Bestätigungs-Karte** (persistiert, kein Auto-Dismiss): große Spielernummer + Name, Von→Nach-Zeile mit farbigen Tisch-Indikatoren und Pfeil
3. **Jede** Umsetzung braucht manuelle Bestätigung – nicht nur die Bank. "Neu auslosen" zieht einen neuen Kandidaten (bzw. bei Auflösung: ein neues Zieltisch) unter Ausschluss der bereits verworfenen
4. Kein Kandidat mehr übrig → "Keine Alternative verfügbar", Reroll deaktiviert, Accept bleibt die einzige Option

**Bekannte Lücke:** Aktuell wird pro Removal nur *ein* Balancing-Vorgang geprüft. Mehrere gleichzeitige Ungleichgewichte an verschiedenen Tischen brauchen eine Schleife, die nach jedem Commit erneut prüft.

## Phasenübergang (admin-getriggert, separat vom laufenden Balancing)

Organisches Balancing bringt euch **nicht zuverlässig** auf exakt N Zieltische. Deshalb: expliziter Reset-Mechanismus.

```js
function endPhase() {
  1. Bestätigungsdialog: "Alle X Spieler werden neu auf Y Tische verteilt, aktuelle Aufteilung geht verloren"
  2. Alle verbleibenden Spieler einsammeln, mischen (Fisher-Yates)
  3. Neue Tische anlegen: Anzahl + maxSeats aus PHASES[nextIndex]
  4. Round-Robin-Verteilung (jeweils an aktuell kleinsten neuen Tisch)
  5. Neue Nummerierung pro neuem Tisch (1.1, 1.2, ... / 2.1, 2.2, ...)
}
```

**⚠️ Fachlich offen, muss vor echtem Einsatz geklärt werden:** `endPhase()` nimmt aktuell *alle* verbleibenden Spieler, nicht nur "Top 4 pro Tisch" wie ursprünglich als Qualifikationsregel besprochen. Dafür fehlt im Datenmodell ein Tracking von Platzierung/Ausscheide-Reihenfolge pro Tisch – muss ergänzt werden, sonst qualifizieren sich die falschen Spieler für HF/Finale.

## Bank / Rebuy-Sonderregel

- Ein Spieler (initial 1.1) ist als `isBank: true` markiert – verantwortlich für Rebuys
- **Kein Blocken**, sondern *immer* Accept/Reroll-Bestätigung, wenn die Bank Teil einer Auslosung ist – in **beide Richtungen** (weggezogen werden UND als Auffüller gezogen werden)
- Rebuy-Phase ist ein eigener Turnier-Status (`rebuyPhaseActive`, admin-gesteuert). Nach Ende der Phase: nur Admin kann noch Spieler hinzufügen/korrigieren, Operator nicht mehr
- Bank-Rolle ist unabhängig vom eigenen Ausscheiden – scheidet 1.1 selbst aus, ist das ein normaler Bust-out, keine Sonderbehandlung nötig

## UI/UX-Anforderungen

**Zwei Ansichten**, per Toggle wechselbar:
- **Liste**: alle Tische untereinander, Chip-Punkte zeigen Belegung, kritische Tische farblich markiert
- **Tische** (visuell): horizontale Tab-Leiste **ohne Scroll** (bei 8 Tischen per `flex-wrap` in mehreren Zeilen), aktiver Tab farblich klar hervorgehoben (Hintergrund in der jeweiligen Tischfarbe, nicht generisch grau)

**Kapsel-Tisch-Darstellung** (statt SVG-Oval): `div` mit großem `border-radius` (Stadium-/Kapselform), hochformatig (breiter als hoch wäre falsch – **höher als breit**, passend zum Handy-Format). Sitzplätze als absolut positionierte Kreise am Rand.

**Jeder Tisch hat eine eigene Farbe** aus einer festen 8er-Palette (dezente Filztöne, kein Neon):
```js
const TABLE_COLORS = ["#3E6B58", "#B98A4E", "#8A4A5B", "#3E5A72", "#6B6B3E", "#9C5A3E", "#5B4A72", "#4A5A4A"];
```
Farbe zieht sich konsequent durch: Tab-Hintergrund → Header-Punkt → Unterstrich unterm Tischnamen → Kapsel-Füllung.

**Am Sitzplatz direkt:**
- Name des Spielers wird unter dem Sitzkreis angezeigt
- Besetzter Sitz: kleiner roter `x`-Button oben rechts am Kreis zum direkten Entfernen
- Leerer Sitz: gestricheltes `+` zum direkten (Schnell-)Hinzufügen mit Default-Namen
- Für Hinzufügen **mit** Namen: Eingabefeld im "Tisch verwalten"-Sheet (Name optional, Default = "Spieler X.Y")
- Eigener "Namen bearbeiten"-Button pro Tisch: Formular mit allen Spielern, jederzeit editierbar (nicht nur beim Anlegen)

**Bookmark / "Mein Tisch":**
- Stern-Button pro Tisch, manuell togglebar
- Zusätzlich: Chip-Reihe "Mein Tisch" (1–8) als Login-Simulation – Auswahl bookmarkt automatisch und springt in die Tisch-Ansicht auf den gewählten Tisch. In der echten App entspricht das dem Login des jeweiligen Tisch-Accounts.

**Umsetzungs-Signal (bei jeder tatsächlichen Umsetzung):**
- Randglühen (`box-shadow`-Puls, Gold) an Quell- und Zieltisch, sowohl in Liste als auch Tab/Kapsel/Sitzplatz
- **Zusätzlich vollflächiger, deutlich sichtbarer Alert**: roter `inset box-shadow`-Puls über den ganzen Screen + kurzer Banner-Text oben ("X.Y setzt um zu Tisch Z"), ca. 1,3s, `pointer-events: none` (blockiert die Bedienung nicht)
- **Für den echten Multi-Device-Betrieb reicht das nicht** – siehe "Offene Architektur-Fragen" unten

## Offene Architektur-Fragen (vor Produktivbetrieb klären)

1. **Push-Benachrichtigungen fehlen.** Der volle Screen-Alert funktioniert nur auf dem Gerät, das gerade den State hält. Für echte Multi-Device-Benachrichtigung (Tisch X wird informiert, dass jemand zu ihm wechselt) braucht es Web Push (Service Worker + Subscription pro Tisch-Gerät) oder mindestens Server-Sent Events/WebSockets, die den State aller Geräte synchron halten. Sollte gezielt nur an Quell- und Zieltisch-Gerät gehen, nicht als Broadcast an alle 8 Geräte (sonst nervt's).
2. **Tie-Breaking-Bug** (siehe oben) – vor Erstnutzung fixen.
3. **Qualifikations-/Platzierungs-Tracking fehlt** – nötig, damit `endPhase()` nur die richtigen Spieler weiterreicht (Top 4 pro Tisch o.ä.), nicht einfach alle verbleibenden.
4. **Schwellwerte sind global, nicht tischgrößen-proportional.** `DISSOLVE_THRESHOLD=2` und `BASELINE=4` gelten aktuell gleich für 6er- und 8er-Tische. Zu klären, ob das bei 8er-HF-Tischen sinnvoll ist oder mitskalieren sollte.
5. **Mehrfach-Balancing pro Removal-Event** fehlt (siehe oben, Punkt 3 im Algorithmus-Abschnitt).
6. **Concurrency:** Mehrere Operatoren könnten gleichzeitig an verschiedenen Tischen Spieler entfernen → Balancing-Race-Conditions. Braucht wahrscheinlich serverseitige Locks oder eine Transaktion pro Balancing-Zyklus.

## Referenz-Implementierung (Design-Preview)

Eine interaktive React-Preview mit dem kompletten UI-Verhalten (aber ohne Backend/Persistenz) existiert bereits als Artifact aus dem Planungs-Chat – gut als visuelle Referenz für Styling, Interaktionsmuster und die Zustandsmaschine der Auslosung, aber **nicht produktionsreif** (kein MongoDB, keine Auth, kein Multi-Device-Sync, State geht bei Reload verloren).
