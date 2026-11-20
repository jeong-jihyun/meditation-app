// 관리자 API 공용 도구 (파일 이름이 _ 로 시작하면 Vercel이 주소로 열지 않는다)
// 필요한 환경변수 (Vercel → Settings → Environment Variables)
//   GOOGLE_CLIENT_ID : Google 로그인용 OAuth 클라이언트 ID (무료)
//   GITHUB_TOKEN     : meditation-app 저장소 Contents(읽기·쓰기) + Actions(읽기) 권한 토큰
//   ADMIN_EMAILS     : (선택) 관리자 이메일, 쉼표로 여러 개. 기본값 mujuk73@gmail.com
//   GITHUB_REPO      : (선택) 기본값 jeong-jihyun/meditation-app
import { createHmac, timingSafeEqual } from "node:crypto";

export const REPO = process.env.GITHUB_REPO || "jeong-jihyun/meditation-app";
export const BRANCH = "main";
export const CATEGORIES = ["breath", "stress", "words"];
export const ADMINS = (process.env.ADMIN_EMAILS || "mujuk73@gmail.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const SESSION_DAYS = 7;

export function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/* ---------- 로그인 세션: Google로 확인한 이메일을 서버가 서명해 7일간 쓴다 ---------- */
// 서명 키는 GITHUB_TOKEN에서 만든다 (환경변수를 하나 덜 넣도록). 토큰을 바꾸면 모두 다시 로그인.
const key = () => createHmac("sha256", "moment-session").update(process.env.GITHUB_TOKEN || "").digest();
const sign = (data) => createHmac("sha256", key()).update(data).digest("base64url");

export function makeSession(user) {
  const data = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return data + "." + sign(data);
}
export function readSession(req) {
  const tok = String(req.headers.authorization || "").replace(/^Bearer /, "");
  const [data, sig] = tok.split(".");
  if (!data || !sig || !process.env.GITHUB_TOKEN) return null;
  const want = Buffer.from(sign(data)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const u = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    return u.exp > Date.now() ? u : null;
  } catch { return null; }
}
export const roleOf = (email) => (ADMINS.includes(String(email).toLowerCase()) ? "admin" : "user");

// 관리자만 통과. 로그인 안 했으면 401, 일반 사용자면 403
export async function guard(req, res) {
  if (!process.env.GITHUB_TOKEN || !process.env.GOOGLE_CLIENT_ID) {
    send(res, 500, { error: "서버 설정이 아직 안 됐어요. Vercel 환경변수 GOOGLE_CLIENT_ID, GITHUB_TOKEN을 넣어 주세요." });
    return false;
  }
  const u = readSession(req);
  if (!u) { send(res, 401, { error: "로그인이 필요해요. 다시 로그인해 주세요." }); return false; }
  if (roleOf(u.email) !== "admin") { send(res, 403, { error: "관리자만 쓸 수 있어요. (" + u.email + "은 일반 사용자예요)" }); return false; }
  req.user = u;
  return true;
}

export async function gh(path, opts = {}) {
  const r = await fetch("https://api.github.com/repos/" + REPO + path, {
    ...opts,
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "moment-admin",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error(ghMessage(r.status, data));
    err.status = r.status;
    err.gh = true; // GitHub 쪽 오류 (관리자 비밀번호 오류와 구분)
    throw err;
  }
  return data;
}

function ghMessage(status, data) {
  if (status === 401) return "GitHub 토큰이 맞지 않거나 만료됐어요. GITHUB_TOKEN을 새로 넣어 주세요.";
  if (status === 403) return "GitHub 토큰 권한이 부족해요. Contents 읽기·쓰기, Actions 읽기 권한이 필요해요.";
  if (status === 404) return "GitHub에서 찾지 못했어요. (저장소 이름이나 토큰 권한을 확인해 주세요)";
  if (status === 409) return "다른 곳에서 먼저 고쳤어요. 목록을 새로 불러온 뒤 다시 저장해 주세요.";
  return "GitHub 오류 " + status + ": " + (data && data.message ? data.message : "");
}

export const b64 = (s) => Buffer.from(s, "utf-8").toString("base64");
export const unb64 = (s) => Buffer.from(s, "base64").toString("utf-8");

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

// 대본 파일 → { meta, body }
export function parseScript(raw) {
  raw = raw.replace(/\r\n/g, "\n");
  const i = raw.indexOf("---\n");
  const head = i < 0 ? "" : raw.slice(0, i);
  const body = i < 0 ? raw : raw.slice(i + 4);
  const meta = {};
  for (const line of head.split("\n")) {
    const k = line.indexOf(":");
    if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
  }
  return { meta, body: body.replace(/\n+$/, "") };
}

const oneLine = (s, max) => String(s ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 10) / 10)) : d; };

// 화면에서 받은 값 → 대본 파일 글자 (검사 포함)
export function buildScript(input, voices) {
  const id = oneLine(input.id, 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) throw new Error("ID는 영문 소문자·숫자·하이픈(-)으로 2~40자여야 해요. 예: sleep-rain");
  const title = oneLine(input.title, 60);
  if (!title) throw new Error("제목을 넣어 주세요.");
  const category = CATEGORIES.includes(input.category) ? input.category : null;
  if (!category) throw new Error("분류를 골라 주세요.");
  const voice = voices.some((v) => v.id === input.voice) ? input.voice : null;
  if (!voice) throw new Error("성우를 골라 주세요.");
  const body = String(input.body || "").replace(/\r\n/g, "\n").replace(/^---$/gm, "—").trim();
  if (body.replace(/~\d+(\.\d+)?/g, "").trim().length < 5) throw new Error("대본 내용을 넣어 주세요.");
  if (body.length > 20000) throw new Error("대본이 너무 길어요. (2만 자 이하)");
  const lines = [
    "id: " + id,
    "category: " + category,
    "title: " + title,
    "desc: " + oneLine(input.desc, 120),
    "voice: " + voice,
    "pitch: " + clamp(input.pitch, -15, 15, 0),
    "rate: " + clamp(input.rate, -40, 30, 0),
    "gap: " + clamp(input.gap, 0.3, 4, 0.9),
    "status: " + (input.status === "published" ? "published" : "draft"),
  ];
  return { id, text: lines.join("\n") + "\n---\n" + body + "\n" };
}

// 오류 응답: GitHub 쪽 오류는 502, 입력 오류는 400
export function fail(res, e) {
  send(res, e.gh ? (e.status === 409 ? 409 : 502) : e.status && e.status < 500 ? e.status : 500, { error: e.message || "알 수 없는 오류" });
}
