// Deterministic PRNG (mulberry32) for reproducible "many trials" fairness tests,
// and a tiny helper to feed pickRandomAmong a fixed sequence of Math.random()-shaped
// values so a specific tie-break candidate can be targeted exactly.
export function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sequenceRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

export function makeTable(id, playerCount) {
  return {
    id,
    players: Array.from({ length: playerCount }, (_, i) => ({
      id: `${id}-p${i}`,
      isBank: false,
    })),
  };
}
