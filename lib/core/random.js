// Tie-breaking fix from the spec: picking the first max/min match by array order
// structurally favors low table numbers whenever sizes are equal. Pick randomly
// among all candidates that hit the target value instead.
export function pickRandomAmong(items, extractValue, mode = "max", rng = Math.random) {
  if (items.length === 0) return undefined;
  const values = items.map(extractValue);
  const target = mode === "max" ? Math.max(...values) : Math.min(...values);
  const candidates = items.filter((item) => extractValue(item) === target);
  return candidates[Math.floor(rng() * candidates.length)];
}

export function randomPick(items, rng = Math.random) {
  if (items.length === 0) return undefined;
  return items[Math.floor(rng() * items.length)];
}

export function fisherYatesShuffle(items, rng = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
