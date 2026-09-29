// Taunting-Sätze für den News-Ticker (Chat-Wunsch: "when a player busts it
// should show player xy busted and a funny sentence with a little tounting
// ... based on position"). Kategorisiert nach verbliebenen AKTIVEN Spielern
// direkt nach dem Bust, nicht nach einem festen "Bubble"-Konzept (die App
// trackt keine Preisgeld-Plätze) - je weniger übrig sind, desto näher am
// "Final Table"-Gefühl.
//
// 47 Sätze, extern generiert (Chat-Wunsch: "create a prompt and i create the
// sentences on a different llm") - Prompt dazu in docs/taunt-sentences-prompt.md.
export const TAUNT_CATEGORIES = {
  // > 15 aktive Spieler übrig
  early: [
    "Kaum hingesetzt, schon wieder Freizeit.",
    "Die Chips waren wohl nur geliehen.",
    "All-in war richtig. Also für den Gegner.",
    "Kurzer Auftritt, beeindruckend wenig Chips danach.",
    "Der Stuhl ist noch warm, die Chips sind schon weg.",
    "Mutig reingestellt. Fachgerecht entsorgt.",
    "Immerhin musst du jetzt keine Blinds mehr zahlen.",
    "Pokerabend erfolgreich auf Zuschauermodus umgestellt.",
    "Das ging schnell. Fast schon professionell.",
    "Andere sammeln Chips. Du sammelst Erfahrungen.",
  ],
  // 6-15 aktive Spieler übrig
  mid: [
    "Die Chips sind weg, aber die Ausreden bleiben.",
    "Stabil gespielt. Bis zu dem Teil mit dem Ausscheiden.",
    "Der Masterplan hatte offenbar eine sehr kurze Laufzeit.",
    "Ein All-in später und plötzlich sehr viel Freizeit.",
    "Ab jetzt kannst du ungefragt Strategie-Tipps geben.",
    "Die Karten hatten andere Pläne. Deutlich bessere sogar.",
    "Lange gekämpft und dann doch fachgerecht entsorgt.",
    "Das sah kurz nach Poker aus. Dann kam der River.",
    "Schöne Chips hattest du da. Hattest.",
    "Die Konkurrenz bedankt sich für die großzügige Spende.",
    "Das Comeback startet dann vermutlich beim nächsten Turnier.",
    "Guter Plan. Beschissenes Ende.",
  ],
  // 3-5 aktive Spieler übrig (Final-Table-Gefühl, ohne festes Bubble-Konzept)
  bubble: [
    "Stundenlang überlebt, um es jetzt noch zu verkacken. Stark.",
    "Das war kein Bust. Das war kontrollierte Selbstzerstörung.",
    "So lange durchgehalten und dann so einen rausgehauen.",
    "Perfektes Timing – falls Ausscheiden der Plan war.",
    "Die Chips waren sicher. Bis du dich eingemischt hast.",
    "Das All-in hatte alles. Außer eine Zukunft.",
    "Die Karten sagen Danke für die unterhaltsame Vorstellung.",
    "Ganz großes Poker. Bis zu dieser eher beschissenen Idee.",
    "Da war die Hoffnung wohl größer als die Hand.",
    "Ein mutiger Move. Mut war leider auch alles daran.",
    "So kann man seine Chips natürlich auch loswerden.",
    "Das nennt man wohl maximale Spannung bei minimalem Erfolg.",
    "Der Pot war groß. Der Schmerz vermutlich auch.",
    "Erst Hoffnung aufgebaut, dann fachgerecht abgerissen.",
    "Die Hand wird in der Analyse bestimmt immer besser.",
  ],
  // <= 2 aktive Spieler übrig (dieser Bust entscheidet quasi den 2. Platz)
  headsUp: [
    "So viel Arbeit für so einen Abgang. Respekt.",
    "Die Chips hatten offensichtlich genug von dir.",
    "Das All-in wird mit jeder Erzählung besser werden.",
    "Lange gezockt, am Ende doch noch alles erfolgreich entsorgt.",
    "Da hilft jetzt auch kein Pokerface mehr.",
    "Ein würdiger Abgang wäre auch eine Option gewesen.",
    "Die Hand sah bestimmt besser aus, bevor alle Karten lagen.",
    "Das war entweder Pech oder moderne Pokerkunst.",
    "Viel Drama, wenig Chips. Klassiker.",
    "Ab jetzt beginnt der wichtigste Teil: die Ausrede.",
  ],
};

// Grenzen für die Kategorie-Wahl (Chat: "sentences based on position").
const BUBBLE_MAX_REMAINING = 5;
const MID_MAX_REMAINING = 15;

function categoryForRemaining(remainingAfterBust) {
  if (remainingAfterBust <= 2) return "headsUp";
  if (remainingAfterBust <= BUBBLE_MAX_REMAINING) return "bubble";
  if (remainingAfterBust <= MID_MAX_REMAINING) return "mid";
  return "early";
}

// Deterministisch statt Math.random() (wichtig!): DashboardBoard.js ruft das
// bei jedem Poll (alle 4s) für denselben Bust erneut auf, solange die
// Ticker-Meldung noch sichtbar ist - mit echtem Zufall würde der Satz dabei
// jedes Mal wechseln, statt für dieses eine Bust-Ereignis stabil zu bleiben.
// seed = etwas Stabiles pro Bust (z.B. player._id) statt einer Zufallszahl.
//
// Bugreport: "text only changes after every second bust or so" - seed ist in
// der Praxis meist eine MongoDB-ObjectId, und Spieler werden bei der
// Turniererstellung per insertMany() in einem Rutsch angelegt: alle ObjectIds
// teilen sich denselben Timestamp- und Prozess-Zufallsteil, unterscheiden
// sich nur im letzten Stück (einem simplen 3-Byte-Zähler). Der reine
// Rolling-Hash unten (hash*31 + charCode) hat für Strings, die sich nur in
// den letzten paar Zeichen unterscheiden, praktisch KEIN Avalanche-Verhalten
// - Nachbar-IDs ergaben fast denselben Hash-Wert und landeten dadurch nach
// dem % sentences.length oft auf demselben oder dem direkt benachbarten
// Satz, statt gut über alle Sätze gestreut zu sein. Die MurmurHash3-
// fmix32-Finalisierung danach mischt die Bits richtig durch (1 Bit Eingabe-
// Unterschied kippt ~50% der Ausgabe-Bits) und behebt das robust, unabhängig
// vom genauen ID-Muster.
function hashSeed(seed) {
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return Math.abs(hash);
}

export function pickTauntSentence(remainingAfterBust, seed) {
  const category = categoryForRemaining(remainingAfterBust);
  const sentences = TAUNT_CATEGORIES[category];
  return sentences[hashSeed(seed) % sentences.length];
}
