// 이 기기에 저장되는 명상 기록 (날짜별 초)
import { createStore, saved } from "./store.js";

export const records = createStore({ log: saved.get("log", {}) });

export function dayKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

let dirty = 0;
export function addLog(sec) {
  if (!(sec > 0)) return;
  const k = dayKey();
  const log = { ...records.get().log, [k]: (records.get().log[k] || 0) + sec };
  records.set({ log });
  if (++dirty >= 5) { saved.set("log", log); dirty = 0; }
}
export const flushLog = () => saved.set("log", records.get().log);
export function resetLog() { records.set({ log: {} }); saved.set("log", {}); }

window.addEventListener("pagehide", flushLog);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushLog(); });

export function stats(log) {
  const days = Object.keys(log).filter((k) => log[k] >= 60).sort();
  const total = Object.values(log).reduce((a, b) => a + b, 0);
  let streak = 0;
  const d = new Date();
  if (!(log[dayKey(d)] >= 60)) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)] >= 60) { streak++; d.setDate(d.getDate() - 1); }
  const now = new Date(), mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = [...Array(7)].map((_, i) => {
    const x = new Date(mon); x.setDate(mon.getDate() + i);
    return { k: dayKey(x), v: log[dayKey(x)] || 0, l: "월화수목금토일"[i] };
  });
  return { days, total, streak, week };
}
