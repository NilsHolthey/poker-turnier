# Individuelle Tischgrößen - was jetzt möglich ist, und ein durchgespielter Turnierablauf

## Was jetzt möglich ist

- **Individuelle Tischgröße pro Tisch beim Anlegen.** Beim Anlegen eines Turniers wählt der Admin für JEDEN Tisch einzeln 6, 7 oder 8 Plätze, statt für alle Tische dieselbe Größe vorzugeben. Beispiel: 50 Spieler passen exakt auf 2 Tische à 7 Plätze + 6 Tische à 6 Plätze (2×7 + 6×6 = 50) - vorher hätte man entweder 9 Tische à 6 (= 54 Plätze, zu viele leer) oder 8 Tische à 7 (= 56 Plätze, noch mehr leer) gebraucht, oder einen Tisch deutlich voller als die anderen gehabt.
- **7er-Tischlayout.** Es gibt jetzt eine passende Sitzanordnung für Tische mit 7 Plätzen, zusätzlich zu den bisherigen 6er- und 8er-Layouts. Das gilt sowohl für die normale Tischansicht als auch fürs TV-Dashboard.
- **Sitzplätze nachträglich entfernen ("Platz entfernen").** Admin kann bei "Tisch verwalten" einen Tisch während der laufenden Vorrunde um genau einen Platz verkleinern (z.B. von 7 auf 6 Plätze), sobald dort mindestens ein Platz frei ist. Dabei werden KEINE Spieler umgesetzt - nur die maximale Platzzahl des Tisches sinkt. Admin bestätigt das über ein kurzes Popup, danach erscheint eine kurze Bestätigung ("Tisch 3: 7 → 6 Plätze").
- **Absicherung dabei:** Die App prüft nicht nur, ob insgesamt genug Plätze frei sind, sondern auch, ob die höchste tatsächlich belegte Sitznummer noch in die neue, kleinere Platzzahl passt. Falls nicht, lehnt sie die Verkleinerung ab ("Erst Spieler umsetzen, bevor der Platz entfernt werden kann") - das verhindert, dass zwei Spieler nach dem Verkleinern versehentlich auf demselben Platz landen.
- **Druckbare Spielerliste.** Es gibt jetzt eine eigene, bewusst schlicht gestaltete Ansicht (nur für Admin), die alle aktiven Spieler nach Tisch gruppiert mit Sitznummer zeigt - gedacht zum Öffnen im normalen Browser (nicht in der installierten App) und als Ganzseiten-Screenshot zum Teilen.
- **Push-Benachrichtigung "Tisch kann verkleinert werden".** Admin bekommt jetzt automatisch eine Benachrichtigung, sobald ein Tisch auf die einheitliche 6er-Basisgröße verkleinert werden könnte (siehe Schritt 3 unten für die genaue Eingrenzung).

## Was NICHT verändert wurde

- Halbfinale und Finale bleiben weiterhin EINHEITLICH in ihrer Tischgröße (standardmäßig 2 Tische à 8 Plätze im Halbfinale, 1 Tisch à 8 Plätze im Finale). Individuelle Tischgrößen gibt es bisher nur in der Vorrunde. Beim Wechsel in die nächste Phase werden sowieso alle noch aktiven Spieler neu gemischt und frisch verteilt - unabhängig davon, wie die Vorrunde-Tische zuletzt zugeschnitten waren.
- "Platz entfernen" bewegt keine Spieler und löst auch keinen Tisch auf - das bleibt weiterhin Sache der automatischen Auflösung bzw. des manuellen "Tisch auflösen"-Buttons.

## Durchgespielter Ablauf: 50 Spieler, 8 Tische, Einfacher Modus

### 1. Anlegen

Admin legt das Turnier mit 50 Spielernamen an und konfiguriert 8 Tische: z.B. Tisch 1 und 2 mit je 7 Plätzen, Tisch 3 bis 8 mit je 6 Plätzen (2×7 + 6×6 = 50, passt exakt). "Einfacher Modus" ist aktiviert. Die Spieler werden zufällig (oder in Listenreihenfolge, falls "Feste Sitzplätze" gewählt wurde) auf diese 8 Tische verteilt, jeder Tisch bis zu seiner eigenen, konfigurierten Größe.

### 2. Vorrunde läuft

Gilt für die gesamte Vorrunde bis zum Halbfinale. Spieler scheiden aus. Im Einfachen Modus gilt dafür nur EINE automatische Regel: Sobald ein Tisch auf 3 Spieler oder weniger geschrumpft ist UND die übrigen Tische zusammen genug freie Plätze haben, um alle seine Spieler aufzunehmen, löst die App diesen Tisch automatisch auf. Reicht der Platz anderswo nicht, bleibt der Tisch einfach mit seiner aktuellen, kleinen Besetzung stehen. Ein automatisches Ausgleichen zwischen unterschiedlich großen Tischen gibt es im Einfachen Modus dagegen nicht.

Beispiel: Tisch 1 (7 Plätze) schrumpft durch Bust-outs auf 3 Spieler. Die anderen 7 Tische haben zusammen genug freie Plätze → Tisch 1 wird aufgelöst, seine 3 Spieler werden einzeln auf die jeweils  anderen Tische verteilt (nicht zufällig auf irgendeinen Tisch mit freiem Platz). Jede einzelne Umsetzung muss bestätigt werden; ein Neu-Auslosen des Ziels gibt es im Einfachen Modus nicht. Von jetzt an sind nur noch 7 Tische aktiv.

### 3. Admin nutzt "Platz entfernen", um Richtung einheitlicher 6er-Tische zu schrumpfen

Unabhängig vom automatischen Auflösen kann der Admin jederzeit selbst nachhelfen: Tisch 2 hat noch 7 Plätze, aber nur 6 Spieler sitzen dort (1 Platz frei) - Admin öffnet "Tisch verwalten" → "Platz entfernen" → bestätigt. Tisch 2 hat jetzt nur noch 6 Plätze, genauso viele wie die übrigen Tische. Das ist rein organisatorisch (z.B. damit am echten Tisch kein unnötiger freier Stuhl steht) und bewegt keine Spieler.

Dafür bekommt der Admin jetzt automatisch eine Push-Benachrichtigung, sobald ein Tisch tatsächlich verkleinert werden könnte, damit er das nicht selbst im Blick behalten muss. Die Benachrichtigung kommt dabei bewusst nicht zu oft/unnötig:

- **Nur im Einfachen Modus.** Im Normalmodus gibt es ohnehin automatisches Ausgleichen zwischen Tischen - dort wäre ein zusätzlicher Hinweis überflüssig bzw. würde sich mit dem bestehenden Ausgleich überschneiden.

- **Nur für Tische, die auf die einheitliche 6er-Basisgröße verkleinert werden können** - also Tische mit 7 oder 8 Plätzen, bei denen genug Plätze frei sind, um auf 6 zu kommen. Nicht gemeint ist jede denkbare weitere Verkleinerung darüber hinaus - das Ziel ist, am Ende überall die gleiche, übliche 6er-Größe zu haben, nicht beliebig weiter zu schrumpfen.

### 4. Weiter durch die Vorrunde

Dieser Ablauf (Bust-outs → gelegentliches automatisches Auflösen bei 3 oder weniger Spielern → optional manuelles "Platz entfernen" zur Konsolidierung) läuft weiter, bis die Spielerzahl auf Halbfinale-Kapazität gesunken ist (Standard: 2 Tische × 8 Plätze = 16 Spieler).

### 5. Halbfinale erreichbar / Halbfinale starten

Sobald nur noch 16 oder weniger Spieler aktiv sind, bekommen der Admin UND alle gerade aktiven Tische eine Push-Benachrichtigung (damit die Operatoren direkt wissen, dass sie pausieren sollen, statt einfach weiterzuspielen), der Admin zusätzlich ein Popup: "Nur noch X Spieler aktiv - passt auf die Halbfinale-Tische, jetzt starten?". Admin bestätigt → alle noch aktiven Spieler werden neu gemischt und zufällig auf 2 neue Tische à 8 Plätze verteilt (feste Halbfinale-Größe, unabhängig davon, wie groß die Vorrunde-Tische zuletzt waren). Alle alten Vorrunde-Tische werden geschlossen, bleiben aber ausgegraut sichtbar.

### 6. Halbfinale läuft

Im Einfachen Modus gibt es WÄHREND des Halbfinales gar kein automatisches Umsetzen mehr - beide Tische schrumpfen unabhängig voneinander durch Bust-outs, bis die Finale-Kapazität erreicht ist (Standard: 1 Tisch × 8 Plätze = 8 Spieler).

**Die letzten 8 Spieler erreichen den Finaltisch entweder als 4+4 oder als 3+5 von den beiden Halbfinale-Tischen - das muss der Admin selbst im Blick behalten, es braucht dafür aber keinen Sonderfall.** Sobald ein Halbfinale-Tisch auf 3 Spieler geschrumpft ist, sind diese 3 automatisch "sicher" fürs Finale (es wird ja ohnehin nichts mehr umgesetzt, solange das Halbfinale läuft) - der ANDERE Halbfinale-Tisch hat dadurch effektiv 5 Plätze am Finaltisch zur Verfügung, statt der sonst üblichen 4. Das funktioniert bereits korrekt, weil beim Finale-Start einfach ALLE noch aktiven Spieler aus BEIDEN Halbfinale-Tischen zusammen neu auf den Finaltisch verteilt werden (siehe Schritt 7) - egal, wie die 8 sich vorher auf die beiden Tische verteilt haben (4+4, 3+5, oder jede andere Kombination).

### 7. Finale erreichbar / Finale starten

Sobald 8 oder weniger Spieler insgesamt aktiv sind, bekommen Admin und alle aktiven Tische dieselbe Art Benachrichtigung wie beim Halbfinale. Admin bestätigt → die verbliebenen Spieler (egal ob 4+4 oder 3+5 von den beiden Halbfinale-Tischen) werden neu gemischt und auf den einen Finaltisch verteilt.

### 8. Finale bis zum Sieger

Der Finaltisch spielt bis auf einen Spieler herunter. Danach gibt es keinen weiteren Phasenwechsel mehr.

## Offene Punkte

- **Unklar/fragwürdig, ob überhaupt nötig:** eine Push-Benachrichtigung für die 3-sicher-fürs-Finale-Situation aus Schritt 6 - sobald ein Halbfinale-Tisch auf 3 Spieler geschrumpft ist, reichen am ANDEREN Halbfinale-Tisch ab diesem Moment schon 5 Spieler (statt wie sonst 4), um zusammen die Finale-Kapazität von 8 zu erreichen. Eine Benachrichtigung könnte den Admin genau auf diese neue, niedrigere Zielzahl am anderen Tisch hinweisen. Dagegen spricht: zu diesem Zeitpunkt sind es ohnehin nur noch sehr wenige Spieler übrig - der Admin bekommt das wahrscheinlich schneller und einfacher live mit, als über einen zusätzlichen Push, der in dieser Endphase eher nervt als hilft. Vor dem Bauen erst klären, ob der Mehrwert den zusätzlichen Alert rechtfertigt.
- "Platz entfernen" gibt es bisher nur in eine Richtung (verkleinern). Einen Platz wieder hinzuzufügen gibt es aktuell nicht - falls das mal gebraucht wird (z.B. versehentlich zu weit verkleinert), bräuchte es eine eigene, umgekehrte Aktion.
