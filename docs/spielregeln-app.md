# Wie die App Entscheidungen trifft

Eine Erklärung ohne Technik-Kauderwelsch: was passiert automatisch, was muss bestätigt werden, und wann startet welche Phase.

## Das Grundprinzip: nichts passiert ohne Bestätigung

Die App würfelt zwar automatisch aus, wer wohin umgesetzt wird - aber **jeder einzelne Umsatz muss von einem Operator oder dem Admin bestätigt werden**. Es gibt einen "Neu auslosen"-Button, falls das Ergebnis nicht passt (z.B. weil zwei Spieler vom selben Tisch kommen und sich eigentlich noch nicht begegnen sollten). Die App setzt nie eigenmächtig jemanden um, ohne dass das am Bildschirm bestätigt wurde.

## Wann wird ein Tisch aufgelöst?

Sobald an einem Tisch nur noch sehr wenige Spieler übrig sind (Standard: 2 oder weniger), löst die App diesen Tisch auf - vorausgesetzt, es gibt noch mindestens einen anderen aktiven Tisch. Die verbliebenen Spieler werden nacheinander an den jeweils kleinsten anderen Tisch verteilt. Dabei steht fest, welcher Spieler als nächstes drankommt - nur das Ziel (welcher Tisch) wird ausgelost.

Während ein Tisch aufgelöst wird, zeigt die App ein rotes Banner "Tisch X wird aufgelöst", damit klar ist, warum gerade ausgelost wird. Am Ende gibt es eine Übersicht mit allen neuen Plätzen auf einen Blick.

## Wann wird ausgeglichen?

Wenn kein Tisch aufgelöst werden muss, aber die Tische deutlich unterschiedlich groß sind (Standard: der kleinste Tisch hat weniger als 4 Spieler UND der Unterschied zum größten Tisch beträgt mindestens 2), zieht die App einen zufälligen Spieler vom größten Tisch und schlägt vor, ihn an den kleinsten Tisch zu setzen. Auch das muss bestätigt werden.

Diese drei Zahlen kann der Admin im Bereich "Turnier bearbeiten" anpassen:

- **Auflöse-Schwelle (Standard: 2):** Ab wie vielen Spielern ODER WENIGER ein Tisch komplett aufgelöst wird. Bei "2" heißt das: Sobald ein Tisch nur noch 2 (oder 1) aktive Spieler hat, wird er aufgelöst.
- **Mindestgröße für Ausgleich (Standard: 4):** Ab welcher Tischgröße ein Tisch überhaupt als "zu klein" gilt. Bei "4" heißt das: Ein Tisch mit 4 oder mehr Spielern wird nie als Grund für einen Ausgleich herangezogen, egal wie groß die anderen Tische sind.
- **Ausgleichs-Unterschied (Standard: 2):** Wie groß der Abstand zwischen dem kleinsten und dem größten Tisch mindestens sein muss, damit überhaupt ausgeglichen wird. Bei "2" heißt das: Ein kleinster Tisch mit 3 Spielern und ein größter Tisch mit 4 Spielern wird NICHT ausgeglichen (Abstand nur 1), aber 3 gegen 5 schon (Abstand 2).

Ein Beispiel mit den Standardwerten: Tisch A hat 3 Spieler, Tisch B hat 6 Spieler. Auflösen greift nicht (3 ist mehr als die Auflöse-Schwelle 2). Ausgleichen greift, weil Tisch A kleiner als die Mindestgröße 4 ist UND der Unterschied zu Tisch B (3) mindestens 2 beträgt - ein Spieler wird von Tisch B nach Tisch A vorgeschlagen.

## Wann startet das Halbfinale bzw. das Finale?

**Nur wenn der Admin es manuell auslöst** - über den Button in der Navigationsleiste ("HF starten", später "Finale starten"). Es gibt keinen automatischen Wechsel nach Zeit oder Spielerzahl.

Beim Klick passiert Folgendes, sofort und ohne weitere Bestätigung:
- Alle noch aktiven Spieler werden komplett neu und zufällig auf die neuen Tische verteilt (standardmäßig 2 Tische für das Halbfinale, 1 Tisch fürs Finale - beides beim Anlegen des Turniers änderbar).
- Die alten Tische werden geschlossen.
- Jeder Spieler bekommt einen neuen Sitzplatz.

Das ist kein einzelner Auslosungsschritt wie beim Auflösen/Ausgleichen, sondern eine komplette Neu-Zuteilung auf einen Schlag. Vorher fragt die App noch einmal nach, weil die aktuelle Sitzordnung dabei verloren geht.

## Wie kommen neue Spieler dazu?

Solange die "Rebuy-Phase" aktiv ist (Standard: ja), dürfen auch die Tisch-Operatoren neue Spieler an ihrem eigenen Tisch eintragen, nicht nur der Admin. Ist die Rebuy-Phase beendet, kann nur noch der Admin neue Spieler hinzufügen. Das hat keinen Einfluss auf Auflösen/Ausgleichen - das prüft die App nur, wenn ein Spieler entfernt wird (Bust-out), nicht wenn einer dazukommt.

## Die Blind-Uhr

Die Blindstruktur zu speichern startet die Uhr **nicht**. Erst der eigene "Turnier starten"-Button setzt die Uhr wirklich in Gang. Danach zählt die App die Level automatisch weiter, sobald die Zeit eines Levels abgelaufen ist - dafür muss niemand etwas anklicken. Der Admin kann die Uhr jederzeit manuell auf ein anderes Level springen lassen oder komplett zurücksetzen (auf Level 1, angehalten), ohne die hinterlegte Struktur zu verlieren.

## Wer darf was?

- **Admin:** darf an jedem Tisch Spieler hinzufügen/entfernen/umbenennen, das Turnier anlegen/bearbeiten/löschen, die Blind-Uhr steuern, und den Phasenwechsel (Halbfinale/Finale) auslösen.
- **Operator (Tisch-Account):** darf nur am eigenen Tisch Spieler hinzufügen (falls Rebuy aktiv), entfernen und umbenennen.

Ein Operator kann also nie an einem fremden Tisch etwas verändern - das verhindert die App aktiv und zeigt einen Hinweis, falls es versucht wird.
