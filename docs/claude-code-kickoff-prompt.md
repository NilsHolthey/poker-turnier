Ich baue eine Next.js-PWA zum Tisch-Management für ein Freundes-Pokerturnier (max. 48 Spieler, Live-Nutzung am Handy während des Turniers). Die komplette Spezifikation liegt in `poker-turnier-mvp-spec.md` in diesem Repo – bitte lies sie zuerst vollständig, bevor du anfängst.

Tech-Stack (nicht verhandelbar): Next.js App Router mit **JavaScript** (kein TypeScript), React function components, CSS Modules, MongoDB, Auth0 für Login, next-pwa fürs PWA-Manifest.

Bitte in dieser Reihenfolge vorgehen:

1. **Next.js-Projekt scaffolden** (`.js`/`.jsx`, App Router, CSS Modules-Setup, ESLint-Basis)
2. **MongoDB-Schema anlegen** exakt wie in der Spezifikation unter "Datenmodell" beschrieben (tournaments, tables, players, moves)
3. **Kern-Logik als eigenes, testbares Modul** implementieren (kein UI-Code vermischt): Balancing-Algorithmus, Dissolve-Algorithmus, Phasenübergang – inklusive des in der Spezifikation genannten Tie-Breaking-Fixes (`pickRandomAmong`). Schreib dafür ein paar Unit-Tests, die die Kernfälle abdecken (Gleichstand zwischen mehreren Tischen, Auflösung bei nur noch 1 Spieler, Bank-Sonderfall in beide Richtungen).
4. **API-Routen** für Spieler entfernen/hinzufügen, Move bestätigen/neu auslosen, Phase beenden – jeweils mit der Rollenprüfung aus der Spezifikation (admin/operator via Auth0 `app_metadata`)
5. **UI** nach den Vorgaben im Abschnitt "UI/UX-Anforderungen" – Kapsel-Tischdarstellung, Tab-Ansicht, Farbschema, Umsetzungs-Signale. Die Design-Preview aus dem Planungs-Chat kann als visuelle Referenz dienen, ist aber nur Vorlage, kein fertiger Code zum 1:1-Übernehmen (kein Backend, kein Auth, State geht bei Reload verloren).

Sprich mich aktiv an, bevor du die Punkte aus "Offene Architektur-Fragen" (Push-Benachrichtigungen, Qualifikations-Tracking, Concurrency) eigenständig entscheidest – das sind fachliche Entscheidungen, keine technischen Details.

Fang mit Schritt 1 und 2 an, zeig mir danach kurz den Stand, bevor du mit der Kern-Logik weitermachst.
