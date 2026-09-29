# Prompt: Taunting-Sätze für den TV-Dashboard-Ticker generieren

Kopier den Block unten in eine andere LLM-Session. Das Ergebnis kommt in `lib/client/tauntSentences.js`, in die vier Arrays unter `TAUNT_CATEGORIES` (Format und Kategorienamen beibehalten, einfach die Beispielsätze ersetzen/erweitern).

---

Ich baue ein TV-Dashboard für ein privates Freundes-Pokerturnier (Live-Tisch-Management-App, 8-48 Spieler). Unten läuft ein News-Ticker mit Sätzen wie: "Spieler XY wurde gebustet! <dein Satz>".

Schreib mir 47 kurze, lustige, freundlich-frotzelnde deutsche Sätze, die NACH so einer "wurde gebustet"-Ankündigung stehen - der Spielername kommt schon vorher, die Sätze selbst brauchen also keinen Namen/Platzhalter. Ton: liebevoller Spott unter Freunden, nie wirklich gemein oder verletzend, kein Bezug auf Aussehen/Charakter der Person - nur auf die Spielsituation (Pech gehabt, zu spät all-in, raus aus dem Turnier, etc.). Kurz genug für eine Ticker-Zeile (max. ca. 90 Zeichen).

Verteil sie auf 4 Kategorien, je nachdem wie viele Spieler nach diesem Bust noch übrig sind (ich hab kein Konzept von Preisgeld-Plätzen/"Bubble" im klassischen Sinn, das hier ist eine grobe Einteilung nach Turnierphase):

- **early** (10 Sätze): mehr als 15 Spieler übrig - lockerer, früh im Turnier, noch nicht viel auf dem Spiel.
- **mid** (12 Sätze): 6-15 Spieler übrig - Mittelphase, das Feld wird langsam kleiner.
- **bubble** (15 Sätze): 3-5 Spieler übrig - kurz vorm Final Table, "so nah dran und trotzdem raus"-Gefühl, das ist die wichtigste Kategorie, hier darf's am meisten frotzeln.
- **headsUp** (10 Sätze): 1-2 Spieler übrig - dieser Bust entscheidet quasi den 2. Platz, kurz vorm großen Finale.

Gib mir das Ergebnis als reines JavaScript-Objekt in genau diesem Format, direkt einsetzbar:

```js
export const TAUNT_CATEGORIES = {
  early: [
    "...",
    // 10 Sätze insgesamt
  ],
  mid: [
    "...",
    // 12 Sätze insgesamt
  ],
  bubble: [
    "...",
    // 15 Sätze insgesamt
  ],
  headsUp: [
    "...",
    // 10 Sätze insgesamt
  ],
};
```
