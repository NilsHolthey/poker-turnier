# Design-Stand vor der Navigation/Admin-Redesign (2026-09-20)

Baseline-Dokumentation vor dem großen Umbau (neue Bottom-Nav, Hamburger-Menü,
Admin-Dashboard, Live-Blinds), damit der "vorher"-Stand nicht verloren geht.
Spätere Chat-Referenzen auf "wie es vorher war" beziehen sich auf dieses
Dokument.

## Navigation/Chrome (aktueller Stand)

- **Header** (`components/TournamentBoard.js`/`.module.css`): eine Zeile, NICHT
  fixed (scrollt normal mit). `.glassChrome`-Optik (Radius 18px, `margin: 16px
  12px 0`). Links `navGroup`: `ViewToggle` (Liste/Tische-Pillenumschalter,
  Textlabels) + `PushToggle` (Benachrichtigungen, operator-only, Icon+Text ab
  640px) + "Neues Turnier" (admin-only, Textbutton). Rechts `accountGroup`:
  Username (nur Name, keine Rolle mehr) + Abmelden-Button (SVG-Icon, Text ab
  640px), öffnet `ConfirmDialog` vor der eigentlichen Navigation zu
  `/auth/logout`.
- **BlindBanner** (`components/BlindBanner.js`/`.module.css`): fixed,
  schwebende Pille unten (`left/right:12px`, `bottom:10px+safe`, Radius 22px,
  `.glassChrome`). Zeigt IMMER "Aktuell" + "Nächstes" Level nebeneinander,
  keine Sortierung nach "nur aktuelles", kein Expand/Collapse. Admin-Controls
  (◂/▸/✎) direkt in der Pille eingebettet, kein separates Menü.
- **MyTableChips / "Dein Tisch"** (`components/MyTableChips.js`/`.module.css`):
  eigene Zeile unter dem Header, zeigt Label "Dein Tisch" + farbiges Badge mit
  Tischname + eigener "⚙ Verwalten"-Button (`margin-left:auto`, rechtsbündig
  in derselben Zeile). Nur sichtbar für operator (admin hat kein "Dein
  Tisch").
- **TableTabs** (`components/TableTabs.js`/`.module.css`): horizontale Pillen,
  `flex-wrap: wrap` (kann bei 8 Tischen auf mehrere Zeilen umbrechen). Nur der
  AKTIVE Tab zeigt den vollen Namen ("Tisch 3"), inaktive zeigen nur die
  Ziffer (`.compact`-Klasse, engeres Padding). Farbübergang beim Wechsel
  animiert (0.45s, `background-color`/`border-color`/`color`/`padding`/
  `box-shadow`).
- **Verwalten-Button unter der Kapsel** (`TournamentBoard.js`
  `.tableActionsRow`): nur für admin gerendert (operator hat den redundanten
  eigenen in MyTableChips entfernt bekommen). Bei admin + weiterer Phase
  daneben zusätzlich der Phasen-Wechsel-Button ("Vorrunde beenden →
  Halbfinale").

## Blind-Logik (aktueller Stand, bewusst NICHT automatisch)

`lib/db/tournamentEngine.js` `setBlindLevelIndex()`:
> "Schaltet das aktuelle Level manuell weiter/zurück (spec-Wunsch: Blinds
> springen nicht automatisch per Timer, der Admin schaltet manuell um)."

Kein Timer, kein serverseitiges Auto-Voranschreiten. `blindSchedule.levels[]`
hat pro Level `smallBlind`, `bigBlind`, `durationMinutes`, `isBreak` -
`durationMinutes` wird aktuell NUR angezeigt (`formatBlindLevel`), nicht für
eine Ablaufberechnung genutzt. `blindSchedule.startTime` existiert als Feld,
wird aber nirgends für eine Live-Berechnung ausgelesen.

**Das ist eine dokumentierte, bewusste Spec-Entscheidung aus der
Ursprungs-Spec, keine Einschränkung aus Zeitgründen.** Die jetzt gewünschte
automatische Weiterschaltung ("blinds increase automatically, or if admin
moves them up") kehrt diese Entscheidung explizit um - analog zur früheren
Abkehr vom "kein tableIds-Scoping"-Grundsatz beim Rollenmodell (siehe
`poker-turnier-mvp-spec.md`, Abschnitt Rollenmodell, dort bereits als
"Update" markiert).

## Design-Tokens/Infrastruktur (aus der "dark glass dashboard"-Umsetzung)

`app/globals.css`:
- Farb-Tokens: `--wine`, `--bronze`, `--deep-teal`, `--background`,
  `--foreground`, `--surface`, `--surface-2`, `--surface-3` (neu, hellste
  Stufe), `--border`, `--text`, `--text-muted`, `--danger`, `--gold`,
  `--accent`, `--accent-rgb` (alphakomponierbar).
- Glass-Tokens: `--glass-bg`, `--glass-bg-enhanced`, `--glass-border`,
  `--glass-highlight`.
- Geteilte Klassen (roher String-Klassenname, nicht CSS-Modul, wie `.glow`):
  `.glassChrome` (+ `::after` Specular-Highlight) - aktuell verwendet von
  `BlindBanner` und dem Header.
- Fonts: `next/font/google`, Bebas Neue → `--font-display` (bisher NICHT
  angewendet, nur die CSS-Variable existiert), DM Sans → `--font-body`
  (bereits aktive Body-Schrift, ersetzt den System-Font-Stack).
- `.fadeBottom` (nicht `.fadeTop` - der wurde entfernt, nachdem der Header
  wieder non-fixed wurde) - blendet Content unter den fixed BlindBanner ein.
- Z-Index-Leiter: Inhalt (kein z-index) · Fade-Gradient 190 · schwebende
  Chrome 200 (BlindBanner) · Sheet-Scrims 299 · Modals/Toasts 500 ·
  FullScreenAlert 600.

## TableCapsule (Tisch-Felt)

`components/TableCapsule.module.css` `.capsule`: `border: 2px solid`
(Tischfarbe per Inline-Style), `background-image: radial-gradient(circle at
30% 18%, rgba(255,255,255,0.1), transparent 55%)` on top of `table.color`
Füllung. Kein Inset-Schatten, keine erhöhte Randstärke - flache Optik. Größe
`min(56vw,240px) × min(93.33vw,400px)` mobil, wächst auf 290×483 (640px) und
320×533 (900px).

## Vertical Spacing (Stand nach der letzten Anpassungsrunde)

- `.header`: `margin: 16px 12px 0`, `padding: 12px 14px`.
- "Dein Tisch"-Zeile: `padding: 20px 16px 0`.
- `.panel`: mobil `margin-top:28px; padding-top:24px`; ≥640px
  `padding:32px 24px 40px`; ≥900px `padding:40px 32px 52px`.
- `TableTabs`: `padding: 20px 16px 40px` (mobil), bottom wächst auf 52px/60px.
- `TableCapsule .wrapper`: `padding:56px 0; gap:28px` (mobil), wächst auf
  72px/36px (640px) und 92px/44px (900px).
- `.board` reserviert `padding-bottom: calc(112px + safe-area-bottom)` für
  die fixed BlindBanner-Pille.

## Bekannte offene Punkte vor dem Redesign

- Zwei separate Buttons für Liste/Tische-Ansicht (`ViewToggle`), keine
  Bottom-Nav.
- Kein Hamburger-Menü, keine Admin-Dashboard-Seite/-Route.
- Blind-Bearbeitung (`BlindScheduleSheet`) wird aktuell über einen Stift-Icon
  in der BlindBanner-Pille geöffnet, nicht aus einem Admin-Bereich.
