const JSON_HEADERS = { "Content-Type": "application/json" };

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Fehler (${res.status})`);
  }
  return res.json();
}

export function createTournament(payload) {
  return fetch("/api/tournaments", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  }).then(handle);
}

export function fetchTournamentState(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/state`).then(handle);
}

export function fetchDashboardState(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/dashboard-state`).then(handle);
}

export function fetchPresence() {
  return fetch("/api/admin/presence").then(handle);
}

export function removePlayer(tournamentId, playerId) {
  return fetch(`/api/tournaments/${tournamentId}/players/${playerId}`, { method: "DELETE" }).then(handle);
}

// Harte Entfernung statt Bust-out (Chat-Wunsch: "full player list ... this
// will an edit not a bust if a player gets removed") - eigene Route, siehe
// app/api/tournaments/[tournamentId]/players/[playerId]/remove/route.js.
export function removePlayerEntry(tournamentId, playerId) {
  return fetch(`/api/tournaments/${tournamentId}/players/${playerId}/remove`, { method: "DELETE" }).then(handle);
}

export function addPlayer(tournamentId, { tableId, name, seatIndex }) {
  return fetch(`/api/tournaments/${tournamentId}/players`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ tableId, name, seatIndex }),
  }).then(handle);
}

export function renamePlayer(tournamentId, playerId, name) {
  return fetch(`/api/tournaments/${tournamentId}/players/${playerId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ name }),
  }).then(handle);
}

export function reseatPlayer(tournamentId, playerId, seatIndex) {
  return fetch(`/api/tournaments/${tournamentId}/players/${playerId}/seat`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ seatIndex }),
  }).then(handle);
}

export function confirmMove(tournamentId, proposal) {
  return fetch(`/api/tournaments/${tournamentId}/moves/confirm`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(proposal),
  }).then(handle);
}

export function rerollMove(tournamentId, proposal, excludeIds) {
  return fetch(`/api/tournaments/${tournamentId}/moves/reroll`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ proposal, excludeIds }),
  }).then(handle);
}

export function endPhase(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/end-phase`, { method: "POST" }).then(handle);
}

export function setBlindSchedule(tournamentId, { startTime, levels, rebuyEndLevelIndex }) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule`, {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({ startTime, levels, rebuyEndLevelIndex }),
  }).then(handle);
}

export function setBlindLevelIndex(tournamentId, currentLevelIndex) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify({ currentLevelIndex }),
  }).then(handle);
}

export function startBlindClock(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule`, { method: "POST" }).then(handle);
}

export function resetBlindClock(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule`, { method: "DELETE" }).then(handle);
}

export function pauseBlindClock(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule/pause`, { method: "POST" }).then(handle);
}

export function resumeBlindClock(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}/blind-schedule/pause`, { method: "DELETE" }).then(handle);
}

export function updateTournament(tournamentId, settings) {
  return fetch(`/api/tournaments/${tournamentId}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(settings),
  }).then(handle);
}

export function deleteTournament(tournamentId) {
  return fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" }).then(handle);
}

export function mergeTable(tournamentId, tableId) {
  return fetch(`/api/tournaments/${tournamentId}/tables/${tableId}/merge`, { method: "POST" }).then(handle);
}

// docs/table-size-kickoff-prompt.md, §3: Sitzplätze nachträglich entfernen.
export function removeTableSeat(tournamentId, tableId) {
  return fetch(`/api/tournaments/${tournamentId}/tables/${tableId}`, { method: "PATCH" }).then(handle);
}

export function subscribePush(subscription) {
  return fetch("/api/push/subscribe", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ subscription }),
  }).then(handle);
}

export function unsubscribePush(endpoint) {
  return fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ endpoint }),
  }).then(handle);
}
