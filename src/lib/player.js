// 소리 엔진: 목소리(CDN) + 배경음(자연 녹음)을 함께 재생한다.
// 화면(React)과 따로 두어, 화면을 고쳐도 재생 로직은 그대로 유지된다.
import { createStore, saved, fade, dispose } from "./store.js";
import { BG, CATS, CDN, catOf, NIGHT_TRACKS } from "../data.js";
import { toast, openScreen, armDim, clearDim, setDimSource } from "./ui.js";
import { addLog } from "./records.js";
import { settings } from "./settings.js";

export const player = createStore({
  tracks: [], base: CDN, loaded: false,
  track: null, cat: CATS[0], bg: CATS[0].bg,
  after: saved.get("after", 0), vVol: saved.get("vVol", 1), bVol: saved.get("bVol", 0.35),
  playing: false, voiceDone: false, afterEnd: 0, cur: 0, dur: 0,
});
const st = () => player.get();
setDimSource(() => st().playing);

const voice = new Audio();
voice.preload = "metadata";
let bgA = null;
let lastTick = Date.now();
let wake = null;

/* ---------- 목록 불러오기 (CDN이 안 되면 앱 서버의 복사본) ---------- */
export async function loadTracks() {
  const tries = [
    [CDN, CDN + "manifest.json?t=" + Math.floor(Date.now() / 600000)],
    ["/audio/", "/audio/manifest.json"],
  ];
  for (const [base, url] of tries) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) continue;
      const j = await r.json();
      if (j.tracks?.length) { player.set({ tracks: j.tracks, base, loaded: true }); return; }
    } catch { /* 다음 주소로 */ }
  }
  player.set({ loaded: true });
}
const voiceUrl = (t) => st().base + t.file + "?v=" + t.hash;

export function todayPick(tracks = st().tracks) {
  if (!tracks.length) return null;
  const h = new Date().getHours(), d = new Date().getDate();
  const night = tracks.filter((t) => NIGHT_TRACKS.includes(t.id));
  const pool = (h >= 21 || h < 5) && night.length ? night : tracks;
  return pool[d % pool.length];
}

/* ---------- 고르기 ---------- */
function setTrack(t) {
  const cat = catOf(t);
  player.set({ track: t, cat, bg: saved.get("bg_" + cat.id, cat.bg), voiceDone: false, cur: 0, dur: t.duration });
  voice.src = voiceUrl(t);
}
export function prepareDefault() { // 앱을 열면 오늘의 추천을 미리 골라 둔다(재생은 안 함)
  if (!st().track) { const t = todayPick(); if (t) setTrack(t); }
}
export function pickTrack(id, autoplay) {
  const t = st().tracks.find((x) => x.id === id);
  if (!t) return;
  if (st().track?.id !== t.id) {
    const keepBg = st().playing;
    stopAll(false, keepBg);
    const bg = st().bg;
    setTrack(t);
    if (keepBg) player.set({ bg }); // 재생 중에 바꾸면 듣던 배경음은 그대로
    voice.load();
  }
  openScreen("player");
  if (autoplay) play();
}

/* ---------- 재생 ---------- */
function startBg() {
  const old = bgA; bgA = null;
  if (old) fade(old, 0, 1000, () => dispose(old));
  const b = BG[st().bg];
  if (!b.src) return;
  const a = new Audio(b.src); a.loop = true; a.volume = 0; bgA = a;
  a.play().then(() => fade(a, st().bVol, 2000)).catch(() => toast("배경음을 불러오지 못했어요"));
}
function stopBg(ms) { const a = bgA; bgA = null; fade(a, 0, ms || 800, () => dispose(a)); }

export function play() {
  const s = st();
  if (!s.track) { toast("먼저 명상을 골라 주세요"); openScreen("explore"); return; }
  player.set({ playing: true }); lastTick = Date.now();
  if (s.voiceDone && (!bgA || s.after === 0)) { // 안내가 끝난 뒤 다시 누르면 처음부터
    player.set({ voiceDone: false }); voice.currentTime = 0;
  }
  if (!st().voiceDone) {
    voice.volume = s.vVol;
    voice.play().catch(() => { player.set({ playing: false }); toast("목소리를 불러오지 못했어요. 인터넷 연결을 확인해 주세요"); });
  }
  if (!bgA) startBg(); else bgA.play().catch(() => {});
  keepAwake(); armDim(); setMedia();
}
export function pause() {
  if (!st().playing) return;
  logNow();
  player.set({ playing: false }); voice.pause();
  if (bgA) { const a = bgA; fade(a, 0, 600, () => { a.pause(); a.volume = st().bVol; }); }
  releaseAwake(); clearDim();
}
export const togglePlay = () => (st().playing ? pause() : play());

export function stopAll(showToast, keepBg) {
  if (st().playing) logNow();
  voice.pause();
  if (!keepBg) { stopBg(1500); player.set({ playing: false }); releaseAwake(); clearDim(); }
  player.set({ voiceDone: false, afterEnd: 0 });
  if (showToast) {
    try { voice.currentTime = 0; } catch { /* 무시 */ }
    player.set({ cur: 0 });
    toast("명상을 마쳤어요. 잘하셨어요");
  }
}

export function seekBy(sec) {
  const s = st();
  if (!s.track) { toast("먼저 명상을 골라 주세요"); return; }
  const d = voice.duration || s.track.duration;
  voice.currentTime = Math.min(Math.max(0, (voice.currentTime || 0) + sec), Math.max(0, d - 0.5));
  if (s.voiceDone && sec < 0) { player.set({ voiceDone: false }); if (s.playing) voice.play().catch(() => {}); }
  player.set({ cur: voice.currentTime });
}
export function seekTo(k) {
  if (!st().track || !voice.duration) return;
  voice.currentTime = k * voice.duration;
  player.set({ voiceDone: false, cur: voice.currentTime });
}

/* ---------- 설정 ---------- */
export function setBg(k) {
  if (k === st().bg) return;
  player.set({ bg: k }); saved.set("bg_" + st().cat.id, k);
  if (st().playing) startBg();
}
export function setAfter(m) {
  player.set({ after: m }); saved.set("after", m);
  if (st().voiceDone && st().playing) armAfter();
  if (m !== 0 && st().bg === "none") toast("배경음을 고르면 안내가 끝난 뒤에도 들을 수 있어요");
  else toast(m === 0 ? "목소리가 끝나면 함께 꺼져요" : m < 0 ? "직접 멈출 때까지 배경음이 계속돼요" : `안내가 끝나고 ${m}분 뒤 꺼져요`);
}
export function setVVol(v) { player.set({ vVol: v }); saved.set("vVol", v); voice.volume = v; }
export function setBVol(v) { player.set({ bVol: v }); saved.set("bVol", v); if (bgA) bgA.volume = v; }
const armAfter = () => player.set({ afterEnd: st().after > 0 ? Date.now() + st().after * 60000 : 0 });

/* ---------- 목소리 이벤트 ---------- */
voice.addEventListener("timeupdate", () => player.set({ cur: voice.currentTime }));
voice.addEventListener("loadedmetadata", () => player.set({ dur: voice.duration }));
voice.addEventListener("ended", () => {
  player.set({ voiceDone: true });
  if (st().after === 0 || !bgA) { stopAll(true); return; }
  armAfter();
  toast(st().after < 0 ? "안내가 끝났어요. 배경음은 계속 흘러요" : `안내가 끝났어요. 배경음은 ${st().after}분 뒤 꺼져요`);
});
voice.addEventListener("error", () => {
  if (st().track && voice.getAttribute("src")) { player.set({ playing: false }); toast("목소리 파일을 아직 불러올 수 없어요"); }
});

/* ---------- 기록 · 배경음 타이머 ---------- */
function logNow() { // 지난 시간만 기록에 더한다 (멈춤 판단은 하지 않음)
  const now = Date.now(), dt = Math.min(300, (now - lastTick) / 1000);
  lastTick = now;
  if (st().playing && dt > 0) addLog(dt);
}
export function tick() {
  logNow();
  const s = st();
  if (s.playing && s.voiceDone && s.afterEnd && Date.now() >= s.afterEnd) { stopAll(true); return; }
  if (s.voiceDone) player.set({ now: Date.now() }); // 남은 시간 표시 갱신
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") { tick(); if (st().playing) keepAwake(); }
});

/* ---------- 화면 켜둠 · 잠금화면 조작 ---------- */
export async function keepAwake() {
  if (!settings.get().awake) return;
  try { if ("wakeLock" in navigator && document.visibilityState === "visible") wake = await navigator.wakeLock.request("screen"); } catch { /* 지원 안 함 */ }
}
export function releaseAwake() { try { wake && wake.release(); } catch { /* 무시 */ } wake = null; }

function setMedia() {
  const s = st();
  if (!("mediaSession" in navigator) || !s.track) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: s.track.title, artist: "MOMENT · " + s.cat.name,
    artwork: [{ src: new URL(s.cat.img, location.href).href, sizes: "620x620", type: "image/jpeg" }],
  });
  const h = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { /* 지원 안 함 */ } };
  h("play", play); h("pause", pause);
  h("seekbackward", () => seekBy(-15)); h("seekforward", () => seekBy(15));
}
