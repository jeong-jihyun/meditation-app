// Google 로그인 확인 → 역할(관리자/일반 사용자)과 세션을 돌려준다.
//   GET  /api/auth/google            → { clientId }  (화면이 Google 버튼을 그릴 때)
//   POST /api/auth/google {credential} → { user, session }
// Google이 준 신원 토큰을 Google 서버(tokeninfo)에 물어 진짜인지 확인한다 (무료).
import { send, readBody, makeSession, roleOf } from "../admin/_lib.js";

export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (req.method === "GET") return send(res, 200, { clientId: clientId || null });
  if (req.method !== "POST") return send(res, 405, { error: "지원하지 않는 요청이에요." });
  if (!clientId || !process.env.GITHUB_TOKEN) return send(res, 500, { error: "로그인 설정이 아직 안 됐어요. (GOOGLE_CLIENT_ID, GITHUB_TOKEN)" });
  try {
    const { credential } = await readBody(req);
    if (!credential) return send(res, 400, { error: "로그인 정보가 없어요." });
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
    const t = await r.json();
    const ok = r.ok && t.aud === clientId && ["accounts.google.com", "https://accounts.google.com"].includes(t.iss)
      && (t.email_verified === true || t.email_verified === "true") && Number(t.exp) * 1000 > Date.now();
    if (!ok) return send(res, 401, { error: "Google 로그인을 확인하지 못했어요. 다시 시도해 주세요." });
    const user = { email: String(t.email).toLowerCase(), name: t.name || t.email, picture: t.picture || "", role: roleOf(t.email) };
    send(res, 200, { user, session: makeSession(user) });
  } catch {
    send(res, 500, { error: "Google 로그인 확인 중 오류가 났어요." });
  }
}
