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
    const tables = Array.from({ length: tableCount }, (_, i) => ({ tableIndex: i, players: [] }));
    players.forEach((player, i) => tables[Math.floor(i / tableSize)].players.push(player));
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
