export const PHASES = [
  { name: "Vorrunde", shortName: "Vorrunde", targetTables: 8, tableSize: 6 },
  { name: "Halbfinale", shortName: "HF", targetTables: 2, tableSize: 8 },
  { name: "Finale", shortName: "Finale", targetTables: 1, tableSize: 8 },
];

export const TABLE_COLORS = [
  "#3E6B58",
  "#B98A4E",
  "#8A4A5B",
  "#3E5A72",
  "#6B6B3E",
  "#9C5A3E",
  "#5B4A72",
  "#4A5A4A",
];

export const DEFAULT_BASELINE = 4;
export const DEFAULT_DISSOLVE_THRESHOLD = 2;
export const DEFAULT_BALANCE_DIFF_THRESHOLD = 2;
// "Mehrere kleine Tische gleichzeitig" (Chat: "all tables with 3 players left
// needs to be tackled") - weder Auflösen noch Ausgleichen greift, wenn
// mehrere Tische unabhängig auf dieselbe kleine Größe schrumpfen. Ab
// SMALL_TABLE_ALERT_COUNT Tischen mit je SMALL_TABLE_THRESHOLD Spielern oder
// weniger bekommt admin eine Push-Benachrichtigung und kann manuell
// zusammenlegen (siehe countSmallTables in lib/core/dissolve.js).
export const DEFAULT_SMALL_TABLE_THRESHOLD = 3;
export const DEFAULT_SMALL_TABLE_ALERT_COUNT = 2;

export const PLAYER_STATUS = ["active", "busted", "advanced"];

export const MOVE_REASONS = ["balance", "dissolve", "phaseTransition", "manual"];

export const ROLES = ["admin", "operator"];
