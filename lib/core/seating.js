// Fixed seat assignment from the spec: seatOf() only looks at the segment after the
// dot, so array/removal order never shifts anyone's physical seat.
export function seatOf(num, maxSeats) {
  const seatSegment = Number(num.split(".")[1]);
  return (seatSegment - 1) % maxSeats;
}

export function tableOrdinalFromLabel(label) {
  const match = label.match(/(\d+)\s*$/);
  return match ? match[1] : "1";
}

// Finds the lowest free seat at a table (existingNums = num of currently active
// players there) and formats it as "<tableOrdinal>.<seat>", e.g. "1.3".
export function nextFreeSeatNum(existingNums, maxSeats, tableOrdinal) {
  const occupied = new Set(existingNums.map((n) => seatOf(n, maxSeats)));
  for (let seat = 0; seat < maxSeats; seat++) {
    if (!occupied.has(seat)) return `${tableOrdinal}.${seat + 1}`;
  }
  return null;
}
