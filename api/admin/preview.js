// 관리자: 지금 고른 성우·톤·속도·쉼으로 대본 앞부분을 바로 들려준다 (저장 전 미리듣기)
// audio/gen.py 와 같은 계산(성우 기본값 + 슬라이더 값)과 같은 Microsoft 음성(edge)을 쓴다.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { guard, gh, unb64, readBody, send, fail, BRANCH } from "./_lib.js";

export const config = { maxDuration: 30 };

const BASE_RATE = -12; // audio/gen.py 와 같은 값
const MAX_CHARS = 260; // 미리듣기는 앞부분만 (빠르게 듣도록)

const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 무료 Microsoft 음성은 <break>(쉼) 태그를 받지 않는다 → 문장마다 따로 만들고 사이에 "조용한 MP3 조각"을 끼운다.
// 아래는 24kHz·48kbps·모노(Microsoft 출력과 같은 형식) 무음 프레임 1개(144바이트 = 0.024초)
const SILENT = Buffer.from("//NkxAAAAANIAAAAAExBTUUzLjEwMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "base64");
const FRAME_SEC = 0.024;
const FRAME_BYTES = 144;
const BYTES_PER_SEC = 6000; // 48kbps
export const silence = (sec) => Buffer.concat(Array(Math.max(0, Math.round(sec / FRAME_SEC))).fill(SILENT));

// 대본 앞부분을 조각으로 나눈다: 한 줄 = 말하기, ~N = 쉬기(미리듣기는 최대 3초), "문장 / 하나 / 둘" = 1초씩 세기
export function toParts(body, gap) {
  const out = [];
  let chars = 0;
  for (const raw of String(body || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const rest = line.match(/^~(\d+(?:\.\d+)?)$/);
    if (rest) { if (out.length) out.push({ rest: Math.min(3, +rest[1]) }); continue; }
    if (line.includes(" / ")) {
      const [first, ...counts] = line.split(" / ").map((p) => p.trim()).filter(Boolean);
      out.push({ say: first }, { rest: 0.4 }, ...counts.map((c) => ({ count: c })));
    } else out.push({ say: line });
    out.push({ rest: gap });
    chars += line.length;
    if (chars >= MAX_CHARS) break;
  }
  while (out.length && out[out.length - 1].rest !== undefined) out.pop();
  return out;
}

// heard: Microsoft가 실제로 읽은 낱말을 모은다 (대본대로 읽었는지 확인용)
async function synth(tts, text, pitch, rate, heard) {
  const { audioStream, metadataStream } = tts.toStream(esc(text), { pitch, rate });
  const words = [];
  metadataStream?.on("data", (c) => {
    try {
      for (const m of JSON.parse(c.toString()).Metadata || [])
        if (m.Type === "WordBoundary" && m.Data?.text?.Text) words.push(m.Data.text.Text);
    } catch { /* 읽기 정보는 없어도 괜찮음 */ }
  });
  const chunks = [];
  for await (const c of audioStream) chunks.push(c);
  heard.push(words.join(" "));
  return Buffer.concat(chunks);
}

// 조각들을 이어 붙여 MP3 하나로 만든다 (say 함수는 시험할 때 바꿔 끼울 수 있다)
export async function assemble(parts, say) {
  const bufs = [silence(0.3)];
  const cache = {};
  for (const p of parts) {
    if (p.rest !== undefined) { bufs.push(silence(p.rest)); continue; }
    const text = p.say ?? p.count;
    let audio = cache[text] || (cache[text] = await say(text));
    if (p.count !== undefined) {
      // 숫자는 정확히 1초: 길면 1초에서 자르고(gen.py와 같음), 짧으면 무음으로 채운다
      const max = Math.floor(BYTES_PER_SEC / FRAME_BYTES) * FRAME_BYTES;
      if (audio.length > max) audio = audio.subarray(0, max);
      bufs.push(audio, silence(Math.max(0, 1 - audio.length / BYTES_PER_SEC)));
    } else bufs.push(audio);
  }
  bufs.push(silence(0.5));
  return Buffer.concat(bufs);
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
    let parts = toParts(input.body, gap);
    if (!parts.length) parts = [{ say: vj.sample || "안녕하세요. 천천히 숨을 들이쉬어 보세요." }];
    const P = `${pitch >= 0 ? "+" : ""}${pitch}Hz`, R = `${rate >= 0 ? "+" : ""}${rate}%`;
    const tts = new MsEdgeTTS();
    await tts.setMetadata(p.engine, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
    let mp3;
    const heard = [];
    try { mp3 = await assemble(parts, (t) => synth(tts, t, P, R, heard)); } finally { tts.close(); }
    if (mp3.length < 1000) throw new Error("소리를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    res.statusCode = 200;
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    // 확인용: 보낸 문장과 실제로 읽은 낱말, 쓴 설정
    res.setHeader("X-Preview-Info", encodeURIComponent(JSON.stringify({ voice: p.engine, pitch: P, rate: R, gap, sent: parts.filter((x) => x.rest === undefined).map((x) => x.say ?? x.count), heard })));
    res.setHeader("Access-Control-Expose-Headers", "X-Preview-Info");
    res.end(mp3);
  } catch (e) {
    fail(res, Object.assign(e, { message: e.message?.startsWith("소리") ? e.message : "미리듣기를 만들지 못했어요: " + (e.message || e) }));
  }
}
