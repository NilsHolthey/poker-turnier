export const MAX_NAME_LENGTH = 25;

// Kürzt lange Spielernamen für die Anzeige auf max. 25 Zeichen plus "…"
// (Chat-Wunsch), damit sie neben dem BANK-$-Tag nicht umbrechen/überlaufen.
// Nur Darstellung - der gespeicherte Name bleibt unverändert.
export function shortName(name) {
  const value = name ?? "";
  return value.length > MAX_NAME_LENGTH ? `${value.slice(0, MAX_NAME_LENGTH)}…` : value;
}
