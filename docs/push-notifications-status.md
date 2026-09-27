# Push-Benachrichtigungen: Stand & offene Punkte

Kontext: Spec verlangt, dass Tische informiert werden, wenn ein Spieler zu
ihnen umgesetzt wird ("Offene Architektur-Frage: Push-Benachrichtigungen").
Entscheidung war: echtes Web Push (nicht nur Polling), weil Handys normalerweise
nicht die ganze Zeit entsperrt sind - plus zusätzliches Polling, damit alle
Tische unabhängig davon aktuell bleiben.

## Was gebaut wurde

- `app/manifest.js` - natives Next.js-Manifest (kein `next-pwa`, siehe
  Begründung im Datei-Kommentar: Next hat eingebaute Unterstützung, `next-pwa`
  wäre ein zusätzliches, Turbopack-riskantes Webpack-Plugin gewesen).
- `public/icons/` - generierte PNG-Icons (192/512/apple-touch), via `sips`
  aus einer SVG-Quelle gerendert, kein zusätzliches Tool nötig.
- `public/sw.js` - Service Worker: `push`-Handler (zeigt Benachrichtigung) und
  `notificationclick`-Handler (fokussiert/öffnet die App). Aktuell inkl.
  temporärem Debug-Logging (siehe unten).
- VAPID-Keypair generiert (`web-push generate-vapid-keys`), liegt nur in
  `.env.local` (gitignored): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- `lib/db/schema.js` - neue Collection `pushSubscriptions`, geschlüsselt nach
  **Nickname** (nicht `tableId`!) - Tisch-Dokumente werden bei jeder
  Phasen-Transition neu angelegt (`endPhase()`), der Nickname->Tisch-Abgleich
  passiert deshalb dynamisch beim Versand, genau wie beim "Mein Tisch"-Mapping
  in `app/page.js` (`tableOrdinalFromLabel` gegen die letzte Ziffer im
  Nickname).
- `lib/server/push.js` - `notifyTable(label, payload)`: löst Label -> Nickname
  auf, schickt gezielt nur an dessen gespeicherte Subscriptions. Wird in
  `applyMove()` (`lib/db/tournamentEngine.js`) nach jedem bestätigten Move an
  Quell- UND Zieltisch aufgerufen - kein Broadcast an alle Geräte, wie in der
  Spec gefordert.
- `app/api/push/subscribe` / `app/api/push/unsubscribe` - Routen zum
  Registrieren/Abmelden einer Subscription.
- `components/PushToggle.js` - Button im Header (nur für `operator`-Rolle),
  registriert den Service Worker und verwaltet die Subscription.
- `components/TournamentBoard.js` - zusätzliches Polling alle 8s
  (`fetchTournamentState`), unabhängig von Push - deckt Geräte ohne
  Berechtigung/Unterstützung ab.
- `scripts/test-push.mjs` (`npm run push:test -- <nickname>`) - schickt eine
  Testbenachrichtigung direkt an alle gespeicherten Subscriptions eines
  Nicknames, ohne den kompletten Spielablauf durchspielen zu müssen.

## Verifiziert (Ende-zu-Ende, auf dem Entwickler-Mac in Chrome)

Per `npm run push:test -- tisch1` und Server-seitigem Debug-Log (siehe
unten) bestätigt, in dieser Reihenfolge:

1. Server sendet erfolgreich an `fcm.googleapis.com` (kein Fehler, `web-push`
   akzeptiert).
2. Chrome empfängt die Nachricht (`chrome://gcm-internals/`:
   `Connection State: CONNECTED`, eigener Registrierungseintrag
   `wp:http://localhost:3000/#...` vorhanden).
3. Der `push`-Event-Handler im Service Worker feuert tatsächlich
   (`[push-debug] {"type":"push-received", ...}` im `npm run dev`-Terminal).
4. Payload wird korrekt als JSON geparst.
5. `self.registration.showNotification()` läuft durch **ohne Fehler**
   (`[push-debug] {"type":"push-shown", ...}`).

Das komplette eigene Code + die Google-Zustellung funktionieren also
nachweislich. **Trotzdem erschien keine sichtbare Benachrichtigung auf dem
Mac.**

## Offen: keine sichtbare Notification auf dem Entwickler-Mac

Da `showNotification()` fehlerfrei durchläuft, liegt das Problem nicht mehr
im Code, sondern vermutlich bei macOS selbst (Chrome übergibt die
Benachrichtigung ans Betriebssystem, das sie still verwirft/unterdrückt).
Nicht mehr weiterverfolgt, weil das Zielgerät laut Spec ohnehin ein Handy pro
Tisch ist, nicht dieser Mac. Falls es später doch relevant wird, zuerst
prüfen:

- macOS Kontrollzentrum -> ist ein Fokus/Bitte-nicht-stören-Modus aktiv?
- Systemeinstellungen -> Benachrichtigungen -> Google Chrome -> "Erlauben"
  an, Warnstil nicht "Keine"?
- Mitteilungszentrale (Datum/Uhrzeit in der Menüleiste) -> steht der Test
  dort überhaupt drin, auch ohne Banner?

## Blocker für den nächsten Test (Handy)

Web Push / Service Worker brauchen HTTPS auf jedem Origin außer `localhost`.
Ein Handy, das die IP des Mac im selben WLAN aufruft, zählt NICHT als
`localhost` - ohne echtes Hosting (oder `next dev --experimental-https` +
akzeptiertes Self-Signed-Zertifikat auf dem Handy) wird das Handy den
Service Worker gar nicht erst registrieren können.

**Nächster Schritt, sobald Hosting steht:** dieselbe Prüfkette wie oben
(`npm run push:test -- <nickname>`, Server-Terminal auf `[push-debug]`
beobachten) direkt gegen die echte Handy-Subscription wiederholen.

## Debug-Tooling (bewusst noch nicht entfernt)

`public/sw.js` schickt bei jedem `push`-Event zusätzlich einen Fetch an
`/api/push/debug-log` (`app/api/push/debug-log/route.js`), der serverseitig
`console.log`t. Das ist unabhängig von DevTools und funktioniert genauso auf
einem Handy, wo eine Service-Worker-Konsole praktisch nicht zugänglich ist -
deshalb absichtlich noch nicht zurückgebaut, bis der Handy-Test durch ist.
Danach kann `debugLog(...)` aus `sw.js` wieder raus und die Route gelöscht
werden.

## Weiterhin offene Architektur-Fragen (aus dem Kickoff-Prompt)

Noch nicht mit dem Nutzer besprochen/entschieden:

- **Qualifikations-Tracking**
- **Concurrency** (abgesehen vom bereits gefixten 409-Fallback bei
  gleichzeitigem Sitzplatz-Belegen in `app/api/tournaments/[tournamentId]/players/route.js`)
