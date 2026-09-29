export const MAX_NAME_LENGTH = 25;

// Kürzt lange Spielernamen für die Anzeige auf max. 25 Zeichen plus "…"
// (Chat-Wunsch), damit sie neben dem BANK-$-Tag nicht umbrechen/überlaufen.
// Nur Darstellung - der gespeicherte Name bleibt unverändert.
export function shortName(name) {
  const value = name ?? "";
  return value.length > MAX_NAME_LENGTH ? `${value.slice(0, MAX_NAME_LENGTH)}…` : value;
}

// Findet einen bereits existierenden Spieler mit demselben Namen (Chat-Wunsch:
// "we have 4 player named Flo, if all get on one table its confusing so check
// against all players") - case-/whitespace-insensitiv, damit "Flo", " flo "
// und "FLO" als dieselbe Kollision zählen. Reine Anzeige-Warnung, kein Verbot
// (echte Namensgleichheit unter Freunden ist möglich) - blockiert das
// Hinzufügen/Umbenennen also nicht, informiert nur.
export function findNameCollision(name, existingPlayers) {
  const target = (name ?? "").trim().toLowerCase();
  if (!target) return null;
  return existingPlayers.find((p) => (p.name ?? "").trim().toLowerCase() === target) ?? null;
}
