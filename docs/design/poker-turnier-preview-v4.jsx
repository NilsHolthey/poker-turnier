import { useState, useEffect, useRef } from "react";
import { X, Plus, Shuffle, Check, ArrowLeft, ArrowRight, Landmark, ChevronRight, Star, List, LayoutGrid, Dice5, Flag, Pencil } from "lucide-react";

const STYLES = `
.pt-root { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 380px; margin: 0 auto; background: #14231C; color: #F1EDE4; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.35); min-height: 720px; position: relative; display: flex; flex-direction: column; }
.pt-header { position: relative; padding: 16px 18px 12px; border-bottom: 1px solid rgba(241,237,228,0.08); overflow: hidden; }
.pt-header-spade { position: absolute; right: -10px; top: -18px; font-size: 90px; color: rgba(212,162,78,0.08); line-height: 1; user-select: none; }
.pt-title { font-size: 17px; font-weight: 600; margin: 0; position: relative; }
.pt-subtitle { font-size: 12.5px; color: #8FA394; margin: 3px 0 10px; position: relative; }
.pt-toggle-row { display: flex; gap: 6px; position: relative; margin-bottom: 6px; }
.pt-toggle-row:last-child { margin-bottom: 0; }
.pt-role-btn { flex: 1; padding: 7px 0; border-radius: 8px; border: 1px solid rgba(241,237,228,0.14); background: transparent; color: #8FA394; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; }
.pt-role-btn.active { background: rgba(212,162,78,0.16); border-color: #D4A24E; color: #D4A24E; }
.pt-endphase-btn { width: 100%; margin-top: 8px; padding: 9px 0; border-radius: 8px; border: 1px solid rgba(193,80,63,0.4); background: rgba(193,80,63,0.08); color: #E08579; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; position: relative; }
.pt-mytable-label { font-size: 10.5px; color: #8FA394; margin: 8px 0 5px; position: relative; }
.pt-mytable-row { display: flex; gap: 5px; position: relative; }
.pt-chip-btn { width: 27px; height: 27px; border-radius: 50%; border: 1.5px solid var(--tc); background: transparent; color: var(--tc); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.pt-chip-btn.active { background: var(--tc); color: #14231C; }
.pt-body { flex: 1; padding: 14px 16px 20px; overflow-y: auto; }
.pt-table-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 14px; background: #1C2E24; border-radius: 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid transparent; transition: border-color 0.15s; }
.pt-table-row.critical { border-color: rgba(193,80,63,0.5); }
.pt-table-row.flashing { animation: pt-glow 1.1s ease-in-out infinite; border-color: #D4A24E; }
.pt-table-left { display: flex; align-items: center; gap: 10px; }
.pt-color-dot { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
.pt-table-label { font-size: 14.5px; font-weight: 500; display: flex; align-items: center; gap: 5px; }
.pt-table-count { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 12px; color: #8FA394; margin-top: 2px; }
.pt-chips { display: flex; gap: 3px; }
.pt-chip { width: 7px; height: 7px; border-radius: 50%; background: #6B9C6E; }
.pt-chip.empty { background: rgba(241,237,228,0.14); }
.pt-chip.warn { background: #D4A24E; }
.pt-chip.crit { background: #C1503F; }
.pt-warn-badge { font-size: 10.5px; color: #C1503F; font-weight: 500; }
@keyframes pt-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(212,162,78,0.5); } 50% { box-shadow: 0 0 0 6px rgba(212,162,78,0); } }
.pt-sheet-header { display: flex; align-items: center; gap: 10px; padding: 16px 16px 12px; border-bottom: 1px solid rgba(241,237,228,0.08); }
.pt-icon-btn { background: transparent; border: none; color: #F1EDE4; cursor: pointer; padding: 4px; display: flex; }
.pt-sheet-title { font-size: 15.5px; font-weight: 600; flex: 1; }
.pt-sheet-count { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 12.5px; color: #8FA394; }
.pt-player-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 4px; border-bottom: 1px solid rgba(241,237,228,0.06); border-radius: 8px; transition: background 0.3s; }
.pt-player-row.flashing { background: rgba(212,162,78,0.14); }
.pt-player-left { display: flex; align-items: center; gap: 10px; }
.pt-player-num { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 13.5px; color: #D4A24E; min-width: 32px; }
.pt-player-name { font-size: 14px; }
.pt-bank-tag { font-size: 10px; color: #D4A24E; background: rgba(212,162,78,0.14); border-radius: 5px; padding: 2px 6px; display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; }
.pt-remove-btn { width: 26px; height: 26px; border-radius: 8px; border: 1px solid rgba(193,80,63,0.35); background: rgba(193,80,63,0.1); color: #E08579; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.pt-addrow { display: flex; gap: 8px; margin-top: 14px; }
.pt-addrow input { flex: 1; background: rgba(241,237,228,0.06); border: 1px solid rgba(241,237,228,0.16); border-radius: 9px; padding: 0 12px; color: #F1EDE4; font-size: 13.5px; height: 38px; }
.pt-addrow input::placeholder { color: #647268; }
.pt-add-icon-btn { width: 38px; height: 38px; border-radius: 9px; border: none; background: #D4A24E; color: #14231C; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.pt-add-icon-btn:disabled { opacity: 0.4; }
.pt-rebuy-note { font-size: 11px; color: #8FA394; text-align: center; margin-top: 8px; }
.pt-overlay { position: absolute; inset: 0; background: rgba(10,16,12,0.75); display: flex; align-items: flex-end; z-index: 10; }
.pt-modal { width: 100%; background: #1C2E24; border-radius: 18px 18px 0 0; padding: 22px 20px 24px; border-top: 1px solid rgba(212,162,78,0.3); }
.pt-modal-icon { width: 44px; height: 44px; border-radius: 50%; background: rgba(212,162,78,0.15); display: flex; align-items: center; justify-content: center; color: #D4A24E; margin-bottom: 12px; }
.pt-modal-icon.danger { background: rgba(193,80,63,0.15); color: #E08579; }
.pt-modal-icon.rolling { animation: pt-spin 0.5s linear infinite; }
@keyframes pt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.pt-modal-title { font-size: 16px; font-weight: 600; margin: 0 0 6px; }
.pt-modal-text { font-size: 13px; color: #8FA394; line-height: 1.5; margin: 0 0 18px; }
.pt-roll-name { font-family: monospace; font-size: 20px; font-weight: 600; color: #D4A24E; text-align: center; padding: 18px 0; letter-spacing: 0.5px; }
.pt-move-card { background: rgba(241,237,228,0.04); border-radius: 12px; padding: 16px; margin-bottom: 16px; }
.pt-move-player { text-align: center; margin-bottom: 12px; }
.pt-move-num { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 26px; font-weight: 600; color: #D4A24E; letter-spacing: 0.5px; }
.pt-move-name { font-size: 14.5px; color: #F1EDE4; margin-top: 2px; }
.pt-move-route { display: flex; align-items: center; justify-content: center; gap: 10px; }
.pt-move-side { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.pt-move-dot { width: 12px; height: 12px; border-radius: 4px; }
.pt-move-label { font-size: 12.5px; color: #8FA394; text-align: center; }
.pt-move-arrow { color: #D4A24E; flex-shrink: 0; }
.pt-modal-actions { display: flex; gap: 10px; }
.pt-btn-secondary { flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(241,237,228,0.18); background: transparent; color: #F1EDE4; font-size: 13.5px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.pt-btn-primary { flex: 1; padding: 12px; border-radius: 10px; border: none; background: #D4A24E; color: #14231C; font-size: 13.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.pt-btn-danger { flex: 1; padding: 12px; border-radius: 10px; border: none; background: #C1503F; color: #F1EDE4; font-size: 13.5px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }
.pt-toast { position: absolute; bottom: 14px; left: 14px; right: 14px; background: #1C2E24; border: 1px solid rgba(212,162,78,0.4); border-radius: 10px; padding: 10px 14px; font-size: 12px; color: #E9D5A8; z-index: 20; display: flex; align-items: center; gap: 8px; animation: pt-toast-in 0.25s ease-out; }
@keyframes pt-toast-in { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.pt-alert-overlay { position: absolute; inset: 0; pointer-events: none; z-index: 12; border-radius: 20px; animation: pt-alert-pulse 1.3s ease-out; }
@keyframes pt-alert-pulse {
  0% { box-shadow: inset 0 0 0 0 rgba(193,80,63,0); background: radial-gradient(ellipse at center, rgba(193,80,63,0.22), transparent 65%); }
  15% { box-shadow: inset 0 0 70px 18px rgba(193,80,63,0.95); }
  55% { box-shadow: inset 0 0 100px 34px rgba(193,80,63,0.55); }
  100% { box-shadow: inset 0 0 0 0 rgba(193,80,63,0); background: transparent; }
}
.pt-alert-banner { position: absolute; top: 0; left: 0; right: 0; z-index: 13; text-align: center; padding: 10px 0; font-size: 12.5px; font-weight: 600; color: #F1EDE4; background: linear-gradient(180deg, rgba(193,80,63,0.9), rgba(193,80,63,0)); pointer-events: none; animation: pt-alert-pulse 1.3s ease-out; letter-spacing: 0.3px; }
.pt-tabstrip { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-bottom: 1px solid rgba(241,237,228,0.08); justify-content: center; }
.pt-tab { padding: 6px 10px; border-radius: 20px; background: rgba(241,237,228,0.05); border: 1px solid transparent; display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 12px; color: #8FA394; transition: background 0.2s, border-color 0.2s; }
.pt-tab.active { color: #F1EDE4; font-weight: 600; }
.pt-tab.flashing { border-color: #D4A24E; animation: pt-glow 1.1s ease-in-out infinite; }
.pt-tab-dot { width: 7px; height: 7px; border-radius: 50%; }
.pt-visual-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 16px 16px 8px; overflow-y: auto; position: relative; }
.pt-visual-headrow { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 4px; width: 100%; }
.pt-visual-dot { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; }
.pt-visual-label { font-size: 19px; font-weight: 700; letter-spacing: 0.2px; }
.pt-visual-underline { width: 46px; height: 3px; border-radius: 2px; margin: 6px 0 16px; }
.pt-star-btn { background: transparent; border: none; color: #8FA394; cursor: pointer; display: flex; }
.pt-star-btn.bookmarked { color: #D4A24E; }
.pt-capsule-outer { position: relative; width: 190px; height: 320px; margin-bottom: 10px; }
.pt-capsule { position: absolute; inset: 0; border-radius: 95px; border: 2px solid rgba(241,237,228,0.1); display: flex; align-items: center; justify-content: center; transition: box-shadow 0.3s; }
.pt-capsule.flashing { animation: pt-glow 1.1s ease-in-out infinite; }
.pt-capsule-center { font-size: 11px; color: rgba(241,237,228,0.5); text-align: center; }
.pt-seat { position: absolute; width: 42px; height: 42px; border-radius: 50%; transform: translate(-50%, -50%); transition: box-shadow 0.3s, border-color 0.3s; }
.pt-seat-filled { width: 100%; height: 100%; border-radius: 50%; background: #1C2E24; border: 2px solid rgba(241,237,228,0.2); display: flex; align-items: center; justify-content: center; flex-direction: column; position: relative; }
.pt-seat-filled.bank { border-color: #D4A24E; }
.pt-seat.flashing .pt-seat-filled { border-color: #D4A24E; box-shadow: 0 0 0 4px rgba(212,162,78,0.3); }
.pt-seat.flashing { animation: pt-glow 1.1s ease-in-out infinite; }
.pt-seat-num { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 11px; font-weight: 600; }
.pt-seat-name { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); margin-top: 3px; font-size: 9.5px; color: #8FA394; white-space: nowrap; max-width: 62px; overflow: hidden; text-overflow: ellipsis; text-align: center; }
.pt-seat-remove { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 50%; background: #C1503F; border: none; color: #F1EDE4; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.pt-seat-empty { width: 100%; height: 100%; border-radius: 50%; background: transparent; border: 2px dashed rgba(241,237,228,0.22); color: rgba(241,237,228,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.pt-manage-row { display: flex; gap: 8px; margin-top: 8px; }
.pt-manage-btn { padding: 10px 18px; border-radius: 10px; border: 1px solid rgba(241,237,228,0.18); background: transparent; color: #F1EDE4; font-size: 12.5px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 5px; }
.pt-editname-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.pt-editname-num { font-family: monospace; font-variant-numeric: tabular-nums; font-size: 12.5px; color: #D4A24E; min-width: 30px; flex-shrink: 0; }
.pt-editname-row input { flex: 1; background: rgba(241,237,228,0.06); border: 1px solid rgba(241,237,228,0.16); border-radius: 9px; padding: 0 12px; color: #F1EDE4; font-size: 13.5px; height: 36px; }
`;

const TABLE_COLORS = ["#3E6B58", "#B98A4E", "#8A4A5B", "#3E5A72", "#6B6B3E", "#9C5A3E", "#5B4A72", "#4A5A4A"];
// Uhrzeigersinn ab unten links. 6er: 3 pro Seite. 8er: zusätzlich Kopf- und Fußende.
const SEAT_POS_6 = [
  { top: "84%", left: "4%" }, { top: "50%", left: "0%" }, { top: "16%", left: "4%" },
  { top: "16%", left: "96%" }, { top: "50%", left: "100%" }, { top: "84%", left: "96%" },
];
const SEAT_POS_8 = [
  { top: "86%", left: "6%" }, { top: "50%", left: "0%" }, { top: "14%", left: "6%" },
  { top: "1%", left: "50%" },
  { top: "14%", left: "94%" }, { top: "50%", left: "100%" }, { top: "86%", left: "94%" },
  { top: "99%", left: "50%" },
];
const seatPositions = (maxSeats) => (maxSeats === 8 ? SEAT_POS_8 : SEAT_POS_6);
const seatOf = (num, maxSeats) => (parseInt(num.split(".")[1], 10) - 1) % maxSeats;
const DISSOLVE_THRESHOLD = 2;
const BASELINE = 4;
const PHASES = [
  { name: "Vorrunde", targetTables: 8, tableSize: 6 },
  { name: "Halbfinale", targetTables: 2, tableSize: 8 },
  { name: "Finale", targetTables: 1, tableSize: 8 },
];

const initialTables = () => {
  const tables = [];
  for (let t = 1; t <= 8; t++) {
    const players = [];
    for (let p = 1; p <= 6; p++) players.push({ id: `${t}.${p}`, num: `${t}.${p}`, name: `Spieler ${t}.${p}`, isBank: t === 1 && p === 1 });
    tables.push({ id: `t${t}`, label: `Tisch ${t}`, players, color: TABLE_COLORS[t - 1], maxSeats: 6 });
  }
  tables[0].players = tables[0].players.slice(0, 6);
  tables[7].players = tables[7].players.slice(0, 3);
  for (let i = 1; i < 7; i++) tables[i].players = tables[i].players.slice(0, 5);
  return tables;
};

function chipStatus(count) {
  if (count <= DISSOLVE_THRESHOLD) return "crit";
  if (count < BASELINE) return "warn";
  return "ok";
}

export default function PokerTurnierPreview() {
  const [tables, setTables] = useState(initialTables);
  const [role, setRole] = useState("operator");
  const [view, setView] = useState("list");
  const [activeTabId, setActiveTabId] = useState("t1");
  const [bookmarkedId, setBookmarkedId] = useState(null);
  const [openTableId, setOpenTableId] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [rollingMove, setRollingMove] = useState(null);
  const [dissolveAnim, setDissolveAnim] = useState(null);
  const [phaseConfirm, setPhaseConfirm] = useState(null);
  const [editNamesTableId, setEditNamesTableId] = useState(null);
  const [draftNames, setDraftNames] = useState({});
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [excludedIds, setExcludedIds] = useState([]);
  const [excludedTableIds, setExcludedTableIds] = useState([]);
  const [rebuyActive, setRebuyActive] = useState(true);
  const [toast, setToast] = useState(null);
  const [flash, setFlash] = useState(null);
  const [alertFlash, setAlertFlash] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const rollIntervalRef = useRef(null);

  const totalPlayers = tables.reduce((s, t) => s + t.players.length, 0);
  const openTable = tables.find((t) => t.id === openTableId);
  const activeTable = tables.find((t) => t.id === activeTabId) || tables[0];
  const nextPhase = PHASES[phaseIndex + 1];

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }
  function triggerFlash(tableIds, playerId) { setFlash({ tableIds, playerId }); setTimeout(() => setFlash(null), 2400); }
  function triggerAlert(msg) { setAlertFlash(msg); setTimeout(() => setAlertFlash(null), 1300); }
  function selectMyTable(tableId) { setBookmarkedId(tableId); setView("visual"); setActiveTabId(tableId); }

  function openEditNames(tableId) {
    const table = tables.find((t) => t.id === tableId);
    const draft = {};
    table.players.forEach((p) => { draft[p.id] = p.name; });
    setDraftNames(draft);
    setEditNamesTableId(tableId);
  }

  function saveNames() {
    setTables(tables.map((t) => {
      if (t.id !== editNamesTableId) return t;
      return { ...t, players: t.players.map((p) => ({ ...p, name: (draftNames[p.id]?.trim() || `Spieler ${p.num}`) })) };
    }));
    setEditNamesTableId(null);
  }

  function startRoll(fromTable, toTable) {
    const pool = fromTable.players.filter((p) => !excludedIds.includes(p.id));
    if (pool.length === 0) return;
    const finalCandidate = pool[Math.floor(Math.random() * pool.length)];
    setRollingMove({ fromTableId: fromTable.id, toTableId: toTable.id, rollingName: pool[0].num });
    let i = 0;
    rollIntervalRef.current = setInterval(() => { i++; setRollingMove((prev) => (prev ? { ...prev, rollingName: pool[i % pool.length].num } : prev)); }, 90);
    setTimeout(() => {
      clearInterval(rollIntervalRef.current);
      setRollingMove(null);
      setPendingMove({ candidate: finalCandidate, fromTableId: fromTable.id, toTableId: toTable.id });
    }, 1300);
  }

  function commitMove(candidate, fromTableId, toTableId) {
    setTables((prev) => prev.map((t) => {
      if (t.id === fromTableId) return { ...t, players: t.players.filter((p) => p.id !== candidate.id) };
      if (t.id === toTableId) return { ...t, players: [...t.players, candidate] };
      return t;
    }));
    const toLabel = tables.find((t) => t.id === toTableId)?.label;
    showToast(`${candidate.num} wechselt zu ${toLabel}`);
    triggerFlash([fromTableId, toTableId].filter(Boolean), candidate.id);
    triggerAlert(`${candidate.num} setzt um zu ${toLabel}`);
    setExcludedIds([]);
    setExcludedTableIds([]);
  }

  function checkBalance(nextTables) {
    const sizes = nextTables.map((t) => t.players.length);
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    if (min < BASELINE && max - min >= 2) {
      const fromTable = nextTables.find((t) => t.players.length === max);
      const toTable = nextTables.find((t) => t.players.length === min);
      startRoll(fromTable, toTable);
    }
  }

  function dissolveTable(tableId) {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    setDissolveAnim({ label: table.label });
    setTimeout(() => {
      setDissolveAnim(null);
      const remaining = tables.filter((t) => t.id !== tableId).map((t) => ({ ...t, players: [...t.players] }));
      if (remaining.length === 0) return;
      const bankPlayer = table.players.find((p) => p.isBank);
      const others = table.players.filter((p) => !p.isBank);
      others.forEach((p) => {
        remaining.sort((a, b) => a.players.length - b.players.length);
        remaining[0].players.push(p);
      });
      setTables(remaining);
      showToast(`${table.label} aufgelöst · ${others.length + (bankPlayer ? 1 : 0)} Spieler verteilt`);
      triggerFlash(remaining.map((t) => t.id), null);
      triggerAlert(`${table.label} aufgelöst – Spieler umgesetzt`);
      if (bankPlayer) {
        remaining.sort((a, b) => a.players.length - b.players.length);
        setPendingMove({ candidate: bankPlayer, fromTableId: null, toTableId: remaining[0].id, dissolveSource: table.label });
      }
    }, 1300);
  }

  function afterRemoval(next) {
    const activeTables = next.filter((t) => t.players.length > 0);
    const shrunk = next.find((t) => t.players.length > 0 && t.players.length <= DISSOLVE_THRESHOLD);
    if (shrunk && activeTables.length > 1) dissolveTable(shrunk.id);
    else checkBalance(next);
  }

  function removePlayer(tableId, playerId) {
    const next = tables.map((t) => (t.id === tableId ? { ...t, players: t.players.filter((p) => p.id !== playerId) } : t));
    setTables(next);
    setExcludedIds([]);
    setExcludedTableIds([]);
    afterRemoval(next);
  }

  function addPlayerAtSeat(tableId, seatIndex, customName) {
    const table = tables.find((t) => t.id === tableId);
    const tIdx = table.label.split(" ").pop();
    const num = `${tIdx}.${seatIndex + 1}`;
    const newPlayer = { id: num, num, name: customName?.trim() ? customName.trim() : `Spieler ${num}`, isBank: false };
    setTables(tables.map((t) => (t.id === tableId ? { ...t, players: [...t.players, newPlayer] } : t)));
    showToast(`${newPlayer.name} an ${table.label} hinzugefügt`);
  }

  function addPlayerNextFree(tableId) {
    const table = tables.find((t) => t.id === tableId);
    const takenSeats = table.players.map((p) => seatOf(p.num, table.maxSeats));
    let seatIndex = 0;
    while (takenSeats.includes(seatIndex) && seatIndex < table.maxSeats) seatIndex++;
    if (seatIndex >= table.maxSeats) return;
    addPlayerAtSeat(tableId, seatIndex, nameInput);
    setNameInput("");
  }

  function acceptMove() { commitMove(pendingMove.candidate, pendingMove.fromTableId, pendingMove.toTableId); setPendingMove(null); }

  function rerollMove() {
    const { candidate, fromTableId, toTableId } = pendingMove;
    if (fromTableId === null) {
      const nextExcluded = [...excludedTableIds, toTableId];
      setExcludedTableIds(nextExcluded);
      const pool = tables.filter((t) => !nextExcluded.includes(t.id));
      if (pool.length === 0) { setPendingMove({ ...pendingMove, noAlternative: true }); return; }
      setPendingMove({ ...pendingMove, rolling: true });
      let i = 0;
      const interval = setInterval(() => { i++; setPendingMove((prev) => (prev ? { ...prev, toTableId: pool[i % pool.length].id } : prev)); }, 90);
      setTimeout(() => { clearInterval(interval); const finalT = pool[Math.floor(Math.random() * pool.length)]; setPendingMove({ ...pendingMove, toTableId: finalT.id, rolling: false }); }, 800);
      return;
    }
    const nextExcluded = [...excludedIds, candidate.id];
    setExcludedIds(nextExcluded);
    const fromTable = tables.find((t) => t.id === fromTableId);
    const pool = fromTable.players.filter((p) => !nextExcluded.includes(p.id));
    if (pool.length === 0) { setPendingMove({ ...pendingMove, noAlternative: true }); return; }
    setPendingMove({ ...pendingMove, rolling: true });
    let i = 0;
    const interval = setInterval(() => { i++; setPendingMove((prev) => (prev ? { ...prev, candidate: pool[i % pool.length] } : prev)); }, 90);
    setTimeout(() => { clearInterval(interval); const finalC = pool[Math.floor(Math.random() * pool.length)]; setPendingMove({ fromTableId, toTableId, candidate: finalC, rolling: false }); }, 800);
  }

  function endPhase() {
    if (!nextPhase) return;
    const allPlayers = tables.flatMap((t) => t.players);
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    const newTables = Array.from({ length: nextPhase.targetTables }, (_, i) => ({ id: `p${phaseIndex + 1}_t${i + 1}`, label: `${nextPhase.name} ${i + 1}`, players: [], color: TABLE_COLORS[i % TABLE_COLORS.length], maxSeats: nextPhase.tableSize }));
    shuffled.forEach((p) => {
      newTables.sort((a, b) => a.players.length - b.players.length);
      const table = newTables[0];
      const tIdx = table.label.split(" ").pop();
      const newNum = `${tIdx}.${table.players.length + 1}`;
      table.players.push({ ...p, num: newNum, id: newNum });
    });
    setTables(newTables);
    setPhaseIndex(phaseIndex + 1);
    setActiveTabId(newTables[0].id);
    setBookmarkedId(null);
    setView("visual");
    setPhaseConfirm(null);
    showToast(`${nextPhase.name} gestartet · ${allPlayers.length} Spieler auf ${newTables.length} Tische verteilt`);
  }

  useEffect(() => () => clearInterval(rollIntervalRef.current), []);

  return (
    <div className="pt-root">
      <style>{STYLES}</style>

      {alertFlash && (
        <>
          <div className="pt-alert-overlay" />
          <div className="pt-alert-banner">{alertFlash}</div>
        </>
      )}

      {!openTable && (
        <div className="pt-header">
          <div className="pt-header-spade">&#9824;</div>
          <p className="pt-title">Freitagsturnier</p>
          <p className="pt-subtitle">{PHASES[phaseIndex].name} &middot; {totalPlayers} Spieler &middot; {tables.length} Tische</p>
          <div className="pt-toggle-row">
            <button className={`pt-role-btn ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}><List size={13} /> Liste</button>
            <button className={`pt-role-btn ${view === "visual" ? "active" : ""}`} onClick={() => setView("visual")}><LayoutGrid size={13} /> Tische</button>
          </div>
          <div className="pt-toggle-row">
            <button className={`pt-role-btn ${role === "operator" ? "active" : ""}`} onClick={() => setRole("operator")}>Operator</button>
            <button className={`pt-role-btn ${role === "admin" ? "active" : ""}`} onClick={() => setRole("admin")}>Admin</button>
          </div>
          {role === "admin" && nextPhase && (
            <button className="pt-endphase-btn" onClick={() => setPhaseConfirm(nextPhase)}>
              <Flag size={13} /> {nextPhase.name} starten ({nextPhase.targetTables} Tische)
            </button>
          )}
          <p className="pt-mytable-label">Mein Tisch (Login-Simulation, je Tisch ein Gerät)</p>
          <div className="pt-mytable-row">
            {tables.map((t) => (
              <button key={t.id} className={`pt-chip-btn ${bookmarkedId === t.id ? "active" : ""}`} style={{ "--tc": t.color }} onClick={() => selectMyTable(t.id)}>
                {t.label.split(" ").pop()}
              </button>
            ))}
          </div>
        </div>
      )}

      {!openTable && view === "list" && (
        <div className="pt-body">
          {tables.map((t) => {
            const status = chipStatus(t.players.length);
            const isFlashing = flash?.tableIds.includes(t.id);
            return (
              <div key={t.id} className={`pt-table-row ${status === "crit" ? "critical" : ""} ${isFlashing ? "flashing" : ""}`} onClick={() => setOpenTableId(t.id)}>
                <div className="pt-table-left">
                  <div className="pt-color-dot" style={{ background: t.color }} />
                  <div>
                    <div className="pt-table-label">{t.label} {bookmarkedId === t.id && <Star size={12} fill="#D4A24E" color="#D4A24E" />}</div>
                    <div className="pt-table-count">{t.players.length}/{t.maxSeats} Spieler</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {status === "crit" && <span className="pt-warn-badge">niedrig</span>}
                  <div className="pt-chips">{Array.from({ length: t.maxSeats }).map((_, i) => <div key={i} className={`pt-chip ${i < t.players.length ? status : "empty"}`} />)}</div>
                  <ChevronRight size={16} color="#8FA394" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!openTable && view === "visual" && (
        <>
          <div className="pt-tabstrip">
            {tables.map((t) => {
              const isFlashing = flash?.tableIds.includes(t.id);
              return (
                <div
                  key={t.id}
                  className={`pt-tab ${activeTabId === t.id ? "active" : ""} ${isFlashing ? "flashing" : ""}`}
                  style={activeTabId === t.id ? { background: `${t.color}55`, borderColor: t.color } : undefined}
                  onClick={() => setActiveTabId(t.id)}
                >
                  <div className="pt-tab-dot" style={{ background: t.color }} />
                  {t.label.replace("Tisch ", "T")}
                  {bookmarkedId === t.id && <Star size={10} fill="#D4A24E" color="#D4A24E" />}
                </div>
              );
            })}
          </div>
          <div className="pt-visual-wrap">
            <div className="pt-visual-headrow">
              <div className="pt-visual-dot" style={{ background: activeTable.color }} />
              <span className="pt-visual-label">{activeTable.label}</span>
              <button className={`pt-star-btn ${bookmarkedId === activeTable.id ? "bookmarked" : ""}`} onClick={() => setBookmarkedId(bookmarkedId === activeTable.id ? null : activeTable.id)}>
                <Star size={16} fill={bookmarkedId === activeTable.id ? "#D4A24E" : "none"} />
              </button>
            </div>
            <div className="pt-visual-underline" style={{ background: activeTable.color }} />
            <div className="pt-capsule-outer">
              <div className={`pt-capsule ${flash?.tableIds.includes(activeTable.id) ? "flashing" : ""}`} style={{ background: `${activeTable.color}33`, borderColor: `${activeTable.color}88` }}>
                <div className="pt-capsule-center" onClick={() => setOpenTableId(activeTable.id)} style={{ cursor: "pointer" }}>{activeTable.players.length}/{activeTable.maxSeats}</div>
              </div>
              {seatPositions(activeTable.maxSeats).map((pos, seatIndex) => {
                const player = activeTable.players.find((p) => seatOf(p.num, activeTable.maxSeats) === seatIndex);
                const isFlashing = player && flash?.playerId === player.id;
                return (
                  <div key={seatIndex} className={`pt-seat ${isFlashing ? "flashing" : ""}`} style={{ top: pos.top, left: pos.left }}>
                    {player ? (
                      <div className={`pt-seat-filled ${player.isBank ? "bank" : ""}`}>
                        <span className="pt-seat-num">{player.num}</span>
                        {player.isBank && <Landmark size={9} color="#D4A24E" />}
                        <button className="pt-seat-remove" onClick={() => removePlayer(activeTable.id, player.id)}><X size={10} /></button>
                        <span className="pt-seat-name">{player.name}</span>
                      </div>
                    ) : (
                      <button className="pt-seat-empty" onClick={() => addPlayerAtSeat(activeTable.id, seatIndex)}><Plus size={16} /></button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-manage-row">
              <button className="pt-manage-btn" onClick={() => setOpenTableId(activeTable.id)}>Tisch verwalten</button>
              <button className="pt-manage-btn" onClick={() => openEditNames(activeTable.id)}><Pencil size={13} /> Namen bearbeiten</button>
            </div>
          </div>
        </>
      )}

      {openTable && (
        <>
          <div className="pt-sheet-header">
            <button className="pt-icon-btn" onClick={() => setOpenTableId(null)}><ArrowLeft size={20} /></button>
            <span className="pt-sheet-title">{openTable.label}</span>
            <span className="pt-sheet-count">{openTable.players.length}/{openTable.maxSeats}</span>
          </div>
          <div className="pt-body">
            {openTable.players.map((p) => (
              <div key={p.id} className={`pt-player-row ${flash?.playerId === p.id ? "flashing" : ""}`}>
                <div className="pt-player-left">
                  <span className="pt-player-num">{p.num}</span>
                  <span className="pt-player-name">{p.name}</span>
                  {p.isBank && <span className="pt-bank-tag"><Landmark size={10} /> Bank</span>}
                </div>
                <button className="pt-remove-btn" onClick={() => removePlayer(openTable.id, p.id)}><X size={15} /></button>
              </div>
            ))}
            <div className="pt-addrow">
              <input type="text" placeholder="Name (optional, sonst Spieler-Nr.)" value={nameInput} onChange={(e) => setNameInput(e.target.value)} disabled={!rebuyActive && role !== "admin"} />
              <button className="pt-add-icon-btn" disabled={(!rebuyActive && role !== "admin") || openTable.players.length >= openTable.maxSeats} onClick={() => addPlayerNextFree(openTable.id)}><Plus size={18} /></button>
            </div>
            {!rebuyActive && <p className="pt-rebuy-note">Rebuy-Phase beendet &middot; {role === "admin" ? "nur Admin kann noch hinzufügen" : "nur Admin kann korrigieren"}</p>}
          </div>
        </>
      )}

      {rollingMove && (
        <div className="pt-overlay">
          <div className="pt-modal">
            <div className="pt-modal-icon rolling"><Dice5 size={20} /></div>
            <p className="pt-modal-title">Auslosung läuft&hellip;</p>
            <p className="pt-modal-text">{tables.find((t) => t.id === rollingMove.fromTableId)?.label} &rarr; {tables.find((t) => t.id === rollingMove.toTableId)?.label}</p>
            <div className="pt-roll-name">{rollingMove.rollingName}</div>
          </div>
        </div>
      )}

      {dissolveAnim && (
        <div className="pt-overlay">
          <div className="pt-modal">
            <div className="pt-modal-icon danger rolling"><Shuffle size={20} /></div>
            <p className="pt-modal-title">{dissolveAnim.label} wird aufgelöst&hellip;</p>
            <p className="pt-modal-text">Verbleibende Spieler werden auf die anderen Tische verteilt.</p>
          </div>
        </div>
      )}

      {pendingMove && (
        <div className="pt-overlay">
          <div className="pt-modal">
            <div className={`pt-modal-icon ${pendingMove.rolling ? "rolling" : ""}`}>{pendingMove.rolling ? <Dice5 size={20} /> : <Shuffle size={20} />}</div>
            <p className="pt-modal-title">{pendingMove.rolling ? "Neu ausgelost..." : "Umsetzung bestätigen"}</p>
            <p className="pt-modal-text">
              {pendingMove.fromTableId === null && `${pendingMove.dissolveSource} wurde aufgelöst.`}
              {pendingMove.noAlternative && " Keine Alternative mehr verfügbar."}
            </p>
            <div className="pt-move-card">
              <div className="pt-move-player">
                <div className="pt-move-num">{pendingMove.candidate.num}</div>
                <div className="pt-move-name">
                  {pendingMove.candidate.name}
                  {pendingMove.candidate.isBank && <span className="pt-bank-tag" style={{ marginLeft: 6 }}><Landmark size={10} /> Bank</span>}
                </div>
              </div>
              <div className="pt-move-route">
                <div className="pt-move-side">
                  {pendingMove.fromTableId && <div className="pt-move-dot" style={{ background: tables.find((t) => t.id === pendingMove.fromTableId)?.color }} />}
                  <span className="pt-move-label">{pendingMove.fromTableId ? tables.find((t) => t.id === pendingMove.fromTableId)?.label : "aufgelöst"}</span>
                </div>
                <ArrowRight size={18} className="pt-move-arrow" />
                <div className="pt-move-side">
                  <div className="pt-move-dot" style={{ background: tables.find((t) => t.id === pendingMove.toTableId)?.color }} />
                  <span className="pt-move-label">{tables.find((t) => t.id === pendingMove.toTableId)?.label}</span>
                </div>
              </div>
            </div>
            <div className="pt-modal-actions">
              <button className="pt-btn-secondary" onClick={rerollMove} disabled={pendingMove.noAlternative || pendingMove.rolling}><Shuffle size={14} /> Neu auslosen</button>
              <button className="pt-btn-primary" onClick={acceptMove} disabled={pendingMove.rolling}><Check size={14} /> Bestätigen</button>
            </div>
          </div>
        </div>
      )}

      {phaseConfirm && (
        <div className="pt-overlay">
          <div className="pt-modal">
            <div className="pt-modal-icon danger"><Flag size={20} /></div>
            <p className="pt-modal-title">{phaseConfirm.name} starten?</p>
            <p className="pt-modal-text">
              Alle {totalPlayers} verbleibenden Spieler werden neu und zufällig auf {phaseConfirm.targetTables} Tische verteilt. Die aktuelle Tischaufteilung geht dabei verloren.
            </p>
            <div className="pt-modal-actions">
              <button className="pt-btn-secondary" onClick={() => setPhaseConfirm(null)}>Abbrechen</button>
              <button className="pt-btn-danger" onClick={endPhase}><Check size={14} /> Bestätigen</button>
            </div>
          </div>
        </div>
      )}

      {editNamesTableId && (
        <div className="pt-overlay">
          <div className="pt-modal">
            <div className="pt-modal-icon"><Pencil size={20} /></div>
            <p className="pt-modal-title">Namen bearbeiten</p>
            <p className="pt-modal-text">{tables.find((t) => t.id === editNamesTableId)?.label} &middot; leer lassen für Standardname.</p>
            {tables.find((t) => t.id === editNamesTableId)?.players.map((p) => (
              <div key={p.id} className="pt-editname-row">
                <span className="pt-editname-num">{p.num}</span>
                <input
                  type="text"
                  value={draftNames[p.id] ?? ""}
                  placeholder={`Spieler ${p.num}`}
                  onChange={(e) => setDraftNames({ ...draftNames, [p.id]: e.target.value })}
                />
              </div>
            ))}
            <div className="pt-modal-actions" style={{ marginTop: 14 }}>
              <button className="pt-btn-secondary" onClick={() => setEditNamesTableId(null)}>Abbrechen</button>
              <button className="pt-btn-primary" onClick={saveNames}><Check size={14} /> Speichern</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="pt-toast"><Star size={12} fill="#E9D5A8" /> {toast}</div>}
    </div>
  );
}
