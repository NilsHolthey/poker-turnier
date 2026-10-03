import { pickRandomAmong, fisherYatesShuffle } from "./random.js";

// Initiales Setzen aller Spieler beim Turnier-Anlegen (Admin-Setup): der erste
// Spieler in der Liste ist immer die Bank und sitzt fest auf 1.1 (spec, "Ein
// Spieler (initial 1.1) ist als isBank markiert" - das ist kein Zufallsergebnis).
// Alle übrigen Spieler werden gemischt und per Round-Robin auf die jeweils
// kleinsten freien Tische verteilt (gleiches Prinzip wie planPhaseTransition).
//
// tableSizes (docs/table-size-kickoff-prompt.md, §1: "Tische können beim
// Anlegen EINZELN mit 6, 7 oder 8 Plätzen konfiguriert werden, z.B. 50
// Spieler = 2×7 + 6×6") - ein Eintrag pro Tisch statt eines einzigen
// globalen tableCount/tableSize-Paars. Jeder Tisch respektiert dabei seine
// EIGENE Kapazität statt einer für alle gleichen.
//
// sequential=true (Chat: "we will actually draw seats by [hand] and they will
// be identical with the seat numbers"): keine Zufallsverteilung - die Liste
// wird einfach Tisch für Tisch bis zur jeweils KONFIGURIERTEN Größe aufgefüllt,
// d.h. Liste "Spieler 1.1, 1.2, ..." landet exakt auf 1.1, 1.2, ...
//
// Verhaltensänderung ggü. der alten tableCount/tableSize-Variante: diese fing
// einen nicht teilbaren Spielerrest früher automatisch über alle Tische
// gleichmäßig auf (Chat-Bugreport: "it's also possible that we get 7x6 and
// 1x3 eg. this should be prevented"). Das ist jetzt Sache der Tischgrößen-
// Konfiguration selbst (genau das 2×7+6×6-Beispiel oben) - eine zusätzliche
// automatische Umverteilung würde eine bewusst gewählte, UNGLEICHE
// Konfiguration (z.B. 2 Tische mit 7, Rest mit 6) stillschweigend wieder
// einebnen, sobald die tatsächliche Spielerzahl die Kapazität nicht exakt
// ausfüllt - das widerspräche dem eigentlichen Zweck dieser Funktion.
export function planInitialSeating(players, { tableSizes, sequential = false }, rng = Math.random) {
  if (players.length === 0) throw new Error("Keine Spieler zum Verteilen");
  const capacity = tableSizes.reduce((sum, size) => sum + size, 0);
  if (players.length > capacity) {
    throw new Error("Mehr Spieler als verfügbare Plätze");
  }

  const [bank, ...rest] = players;

  if (sequential) {
    const tables = tableSizes.map((size, i) => ({ tableIndex: i, size, players: [] }));
    let cursor = 0;
    for (const table of tables) {
      table.players = players.slice(cursor, cursor + table.size);
      cursor += table.size;
    }
    const assignments = tables.flatMap((table) =>
      table.players.map((player, seatIdx) => ({
        player,
        tableIndex: table.tableIndex,
        num: `${table.tableIndex + 1}.${seatIdx + 1}`,
        isBank: player === bank,
      }))
    );
    return { tables, assignments };
  }

  const tables = tableSizes.map((size, i) => ({ tableIndex: i, size, players: [] }));
  tables[0].players.push(bank);

  const shuffled = fisherYatesShuffle(rest, rng);
  for (const player of shuffled) {
    const candidates = tables.filter((t) => t.players.length < t.size);
    const target = pickRandomAmong(candidates, (t) => t.players.length, "min", rng);
    target.players.push(player);
  }

  const assignments = tables.flatMap((table) =>
    table.players.map((player, seatIdx) => ({
      player,
      tableIndex: table.tableIndex,
      num: `${table.tableIndex + 1}.${seatIdx + 1}`,
      isBank: player === bank,
    }))
  );

  return { tables, assignments };
}
