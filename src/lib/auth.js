// Google 로그인 (무료 Google Identity Services)
// - 관리자 이메일(서버 ADMIN_EMAILS, 기본 mujuk73@gmail.com)로 로그인하면 관리자 모드
// - 그 밖의 계정은 일반 사용자
// 로그인하지 않아도 앱은 그대로 쓸 수 있다.
import { createStore, saved } from "./store.js";

export const auth = createStore({ user: saved.get("auth", null)?.user || null, session: saved.get("auth", null)?.session || "", ready: false, error: "", enabled: null });
export const isAdmin = (s = auth.get()) => s.user?.role === "admin";

let gisPromise = null;
let clientId = null;

// 서버에 Google 로그인이 설정돼 있는지 확인 (설정 전이면 로그인 카드를 숨긴다)
let checkPromise = null;
export function checkLogin() {
  if (!checkPromise) {
    checkPromise = fetch("/api/auth/google")
      .then((r) => (r.ok ? r.json() : {}))
      .then((j) => { clientId = j.clientId || null; auth.set({ enabled: !!clientId }); return !!clientId; })
      .catch(() => { auth.set({ enabled: false }); return false; });
  }
  return checkPromise;
}

function loadGis() {
  if (!gisPromise) {
    gisPromise = (async () => {
      if (!(await checkLogin())) throw new Error("로그인 설정이 아직 안 됐어요.");
      await new Promise((ok, fail) => {
        if (window.google?.accounts?.id) return ok();
        const s = document.createElement("script");
        s.src = "https://accounts.google.com/gsi/client";
        s.async = true; s.onload = ok; s.onerror = () => fail(new Error("Google 로그인을 불러오지 못했어요."));
        document.head.appendChild(s);
      });
      window.google.accounts.id.initialize({ client_id: clientId, callback: onCredential, auto_select: false, ux_mode: "popup" });
    })().catch((e) => { gisPromise = null; throw e; });
  }
  return gisPromise;
}

async function onCredential({ credential }) {
  auth.set({ error: "" });
  try {
    const r = await fetch("/api/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credential }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "로그인하지 못했어요.");
    saved.set("auth", { user: j.user, session: j.session });
    auth.set({ user: j.user, session: j.session });
  } catch (e) { auth.set({ error: e.message }); }
}

// el 안에 Google 로그인 버튼을 그린다
export async function renderGoogleButton(el) {
  if (!el) return;
  try {
    await loadGis();
    el.innerHTML = "";
    window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "signin_with", locale: "ko", width: Math.min(320, el.clientWidth || 300) });
    auth.set({ ready: true });
  } catch (e) { auth.set({ error: e.message }); }
}

export function logout() {
  saved.set("auth", null);
  auth.set({ user: null, session: "", error: "" });
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* 무시 */ }
}

// 관리자 API 호출 (세션을 함께 보냄). 세션이 끝났으면 로그아웃 처리
export async function adminApi(path, opts = {}) {
  const r = await fetch("/api/admin/" + path, {
    ...opts,
    headers: { Authorization: "Bearer " + auth.get().session, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
  });
  let j = {};
  try { j = await r.json(); } catch { /* 빈 응답 */ }
  if (r.status === 401) logout();
  if (!r.ok) throw Object.assign(new Error(j.error || "서버에 연결하지 못했어요. (" + r.status + ")"), { status: r.status });
  return j;
}

// 관리자 API에서 소리(MP3)를 받아 재생용 주소로 돌려준다 (미리듣기)
export async function adminAudio(path, body) {
  const r = await fetch("/api/admin/" + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + auth.get().session, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (r.status === 401) logout();
  if (!r.ok) {
    let j = {};
    try { j = await r.json(); } catch { /* 빈 응답 */ }
    throw new Error(j.error || "미리듣기를 만들지 못했어요. (" + r.status + ")");
  }
  return URL.createObjectURL(await r.blob());
}
