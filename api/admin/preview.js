// 관리자: 지금 고른 성우·톤·속도·쉼으로 대본 앞부분을 바로 들려준다 (저장 전 미리듣기)
// audio/gen.py 와 같은 계산(성우 기본값 + 슬라이더 값)과 같은 Microsoft 음성(edge)을 쓴다.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { guard, gh, unb64, readBody, send, fail, BRANCH } from "./_lib.js";

export const config = { maxDuration: 30 };

const BASE_RATE = -12; // audio/gen.py 와 같은 값
const MAX_CHARS = 260; // 미리듣기는 앞부분만 (빠르게 듣도록)

const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brk = (sec) => `<break time="${Math.round(sec * 1000)}ms"/>`;

// 대본 앞부분을 SSML로 바꾼다: 한 줄 = 한 번 말하기, ~N = 쉬기(미리듣기는 최대 3초), "문장 / 하나 / 둘" = 1초씩 세기
export function toSSML(body, gap) {
  const out = [];
  let chars = 0;
  for (const raw of String(body || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const rest = line.match(/^~(\d+(?:\.\d+)?)$/);
    if (rest) { if (out.length) out.push(brk(Math.min(3, +rest[1]))); continue; }
    if (line.includes(" / ")) {
      const [first, ...counts] = line.split(" / ").map((p) => p.trim()).filter(Boolean);
      out.push(esc(first) + brk(0.4) + counts.map((c) => esc(c) + brk(0.6)).join(""));
      chars += line.length;
    } else {
      out.push(esc(line));
      chars += line.length;
    }
    out.push(brk(gap));
    if (chars >= MAX_CHARS) break;
  }
  while (out.length && out[out.length - 1].startsWith("<break")) out.pop();
  return out.join("");
}

async function synth(engine, ssml, pitch, rate) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(engine, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  try {
    const { audioStream } = tts.toStream(ssml, { pitch, rate });
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    return Buffer.concat(chunks);
  } finally { tts.close(); }
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  if (req.method !== "POST") return send(res, 405, { error: "지원하지 않는 요청이에요." });
  try {
    const input = await readBody(req);
    const vj = JSON.parse(unb64((await gh(`/contents/audio/voices.json?ref=${BRANCH}`)).content));
    const p = vj.voices.find((v) => v.id === input.voice) || vj.voices[0];
    const pitch = Math.round(p.pitch + num(input.pitch, 0, -20, 20));
    const rate = Math.round(BASE_RATE + p.rate + num(input.rate, 0, -40, 30));
    const gap = num(input.gap, 0.9, 0.2, 5);
    const ssml = toSSML(input.body, gap) || esc(vj.sample || "안녕하세요. 천천히 숨을 들이쉬어 보세요.");
    const mp3 = await synth(p.engine, ssml, `${pitch >= 0 ? "+" : ""}${pitch}Hz`, `${rate >= 0 ? "+" : ""}${rate}%`);
    if (mp3.length < 1000) throw new Error("소리를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.end(mp3);
  } catch (e) {
    fail(res, Object.assign(e, { message: e.message?.startsWith("소리") ? e.message : "미리듣기를 만들지 못했어요: " + (e.message || e) }));
  }
}
