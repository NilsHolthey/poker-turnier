"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

// true erst NACH Hydration - SSR und der erste Client-Render liefern beide
// false (identisch, kein Mismatch), React rendert danach automatisch mit dem
// Client-Snapshot neu. Für Portale gedacht, die document.body brauchen (siehe
// Toast.js/BlindPill.js), das existiert serverseitig nicht. Sauberer als ein
// useEffect+setState("mounted", true)-Pattern, das der react-hooks/
// set-state-in-effect-Compiler-Lint als synchrones setState im Effekt-Body
// beanstandet.
export function useMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
