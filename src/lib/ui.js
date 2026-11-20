// 화면 이동, 설정 창, 알림, 잠들기 화면(어둡게)
import { createStore } from "./store.js";
import { settings } from "./settings.js";

export const ui = createStore({ screen: "home", sheet: null, toast: "", toastId: 0, dimOn: false });

export function openScreen(screen) {
  ui.set({ screen });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
export const openSheet = (sheet) => ui.set({ sheet });
export const closeSheet = () => ui.set({ sheet: null });

let toastTimer;
export function toast(msg) {
  ui.set((s) => ({ toast: msg, toastId: s.toastId + 1 }));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.set({ toast: "" }), 2300);
}

// 재생 중 15초 동안 손대지 않으면 화면을 어둡게
let dimTimer;
let isPlaying = () => false;
export function setDimSource(fn) { isPlaying = fn; }
export function armDim() {
  clearTimeout(dimTimer);
  if (settings.get().dim && isPlaying()) dimTimer = setTimeout(() => ui.set({ dimOn: true }), 15000);
}
export function clearDim() { clearTimeout(dimTimer); ui.set({ dimOn: false }); }
export function wakeDim() { ui.set({ dimOn: false }); armDim(); }
