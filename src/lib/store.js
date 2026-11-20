// 작은 상태 저장소 + 기기 저장(localStorage) 도우미
import { useSyncExternalStore } from "react";

export const saved = {
  get(k, d) {
    try { const v = localStorage.getItem("moment." + k); return v == null ? d : JSON.parse(v); } catch { return d; }
  },
  set(k, v) {
    try { localStorage.setItem("moment." + k, JSON.stringify(v)); } catch { /* 저장 공간이 막힌 경우 무시 */ }
  },
};

// 상태가 바뀌면 구독한 화면이 다시 그려진다
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const next = typeof patch === "function" ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((l) => l());
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}

export function useStore(store) {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(x).padStart(2, "0");
};
export const mins = (s) => Math.max(1, Math.round(s / 60)) + "분";

// 음량을 부드럽게 바꾼다 (아이폰은 음량 조절이 막혀 있어 무시됨)
export function fade(a, to, ms, done) {
  if (!a) { done && done(); return; }
  const from = a.volume, t0 = performance.now();
  (function f(now) {
    const k = Math.min(1, (now - t0) / ms);
    try { a.volume = from + (to - from) * k; } catch { /* 무시 */ }
    k < 1 ? requestAnimationFrame(f) : done && done();
  })(t0);
}
export function dispose(a) {
  if (!a) return;
  a.pause(); a.removeAttribute("src"); a.load();
}
