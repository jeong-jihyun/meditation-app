// 설정(화면 켜두기·잠들기 화면·자동 밤 테마)과 테마
import { createStore, saved } from "./store.js";
import { THEMES } from "../data.js";

const s0 = saved.get("settings", { awake: true, dim: true });
export const settings = createStore({
  awake: s0.awake !== false,
  dim: s0.dim !== false,
  autoNight: !!s0.autoNight,
  theme: saved.get("theme", "sage"),
});

function persist() {
  const { awake, dim, autoNight, theme } = settings.get();
  saved.set("settings", { awake, dim, autoNight });
  saved.set("theme", theme);
}

export function toggleSetting(k) { settings.set((s) => ({ [k]: !s[k] })); persist(); applyTheme(); }
export function chooseTheme(id) { settings.set({ theme: id }); persist(); applyTheme(); }

export const isNightHour = () => { const h = new Date().getHours(); return h >= 21 || h < 6; };
export function activeThemeId() {
  const s = settings.get();
  return s.autoNight && isNightHour() ? "night" : s.theme;
}
// 배치는 그대로 두고 body의 색 변수만 바꾼다
export function applyTheme() {
  const t = THEMES.find((x) => x.id === activeThemeId()) || THEMES[0];
  if (t.id === "sage") delete document.body.dataset.theme; else document.body.dataset.theme = t.id;
  document.getElementById("metaTheme")?.setAttribute("content", t.bar);
}
