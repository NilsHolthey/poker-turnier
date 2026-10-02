import { pickRandomAmong, fisherYatesShuffle } from "./random.js";

// Initiales Setzen aller Spieler beim Turnier-Anlegen (Admin-Setup): der erste
// Spieler in der Liste ist immer die Bank und sitzt fest auf 1.1 (spec, "Ein
// Spieler (initial 1.1) ist als isBank markiert" - das ist kein Zufallsergebnis).
// Alle übrigen Spieler werden gemischt und per Round-Robin auf die jeweils
// kleinsten freien Tische verteilt (gleiches Prinzip wie planPhaseTransition).
//
// sequential=true (Chat: "we will actually draw seats by [hand] and they will
// be identical with the seat numbers"): keine Zufallsverteilung - Spieler i
// sitzt in Listenreihenfolge auf Tisch floor(i/tableSize)+1, Platz i%tableSize+1,
// d.h. Liste "Spieler 1.1, 1.2, ..." landet exakt auf 1.1, 1.2, ...
export function planInitialSeating(players, { tableCount, tableSize, sequential = false }, rng = Math.random) {
  if (players.length === 0) throw new Error("Keine Spieler zum Verteilen");
  if (players.length > tableCount * tableSize) {
    throw new Error("Mehr Spieler als verfügbare Plätze");
  }

  const [bank, ...rest] = players;

  if (sequential) {
    // Gleichmäßig statt Tisch-für-Tisch stur vollschreiben (Chat-Wunsch:
    // "it's also possible that we get 7x6 and 1x3 eg. this should be
    // prevented") - vorher landeten bei z.B. 14 Spielern/3 Tischen á 6 immer
    // volle Tische zuerst (6, 6, 2) statt den Fehlbetrag über alle zu
    // verteilen (5, 5, 4). Die ersten `remainder` Tische bekommen einen
    // Spieler mehr als der Rest - Listenreihenfolge bleibt INNERHALB jedes
    // Tisches erhalten (das ist der eigentliche Zweck von "sequential": Platz
    // in der Liste = Sitznummer), nur die Tischgrenzen verschieben sich.
    const tables = Array.from({ length: tableCount }, (_, i) => ({ tableIndex: i, players: [] }));
    const base = Math.floor(players.length / tableCount);
    const remainder = players.length % tableCount;
    let cursor = 0;
    tables.forEach((table, i) => {
      const count = base + (i < remainder ? 1 : 0);
      table.players = players.slice(cursor, cursor + count);
      cursor += count;
    });
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

  const tables = Array.from({ length: tableCount }, (_, i) => ({ tableIndex: i, players: [] }));
  tables[0].players.push(bank);

  const shuffled = fisherYatesShuffle(rest, rng);
  for (const player of shuffled) {
    const candidates = tables.filter((t) => t.players.length < tableSize);
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
