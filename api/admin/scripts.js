// 관리자: 명상 대본 목록 보기(GET) · 저장(POST) · 삭제(DELETE)
// 저장하면 GitHub 저장소 audio/scripts/ 에 대본이 올라가고,
// GitHub Actions(voice.yml)가 성우 목소리 MP3를 만들어 앱에 반영한다.
import { guard, gh, send, fail, b64, unb64, readBody, parseScript, buildScript, REPO, BRANCH } from "./_lib.js";

const DIR = "audio/scripts";

async function readJson(path, fallback) {
  try { return JSON.parse(unb64((await gh(`/contents/${path}?ref=${BRANCH}`)).content)); } catch { return fallback; }
}

async function list() {
  const [files, voices, manifest, drafts, samples, head] = await Promise.all([
    gh(`/contents/${DIR}?ref=${BRANCH}`),
    readJson("audio/voices.json", { voices: [] }),
    readJson("audio/manifest.json", { tracks: [] }),
    readJson("audio/drafts.json", { tracks: [] }),
    readJson("audio/samples.json", {}),
    gh(`/commits/${BRANCH}`),
  ]);
  const built = {};
  for (const t of manifest.tracks || []) built[t.id] = { ...t, status: "published" };
  for (const t of drafts.tracks || []) built[t.id] = { ...t, status: "draft" };

  const scripts = await Promise.all(files.filter((f) => f.name.endsWith(".txt")).map(async (f) => {
    const raw = unb64((await gh(`/contents/${f.path}?ref=${BRANCH}`)).content);
    const { meta, body } = parseScript(raw);
    const b = built[meta.id];
    // stale: 저장한 대본이 아직 소리로 만들어지지 않음 (gen.py가 적어 둔 대본 sha와 다름)
    return { path: f.path, sha: f.sha, meta, body, built: b ? { ...b, stale: !!b.src && b.src !== f.sha } : null };
  }));
  // 파일이 커밋에 고정된 CDN 주소 (캐시 때문에 옛 소리가 나오는 일이 없음)
  const cdn = `https://cdn.jsdelivr.net/gh/${REPO}@${head.sha}/audio/`;
  return { repo: REPO, commit: head.sha, cdn, voices: voices.voices || [], sample: voices.sample || "", samples, scripts };
}

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  try {
    if (req.method === "GET") return send(res, 200, await list());

    if (req.method === "POST") {
      const input = await readBody(req);
      const voices = (await readJson("audio/voices.json", { voices: [] })).voices;
      const { id, text } = buildScript(input, voices);
      // 기존 대본이면 같은 파일을 고치고, 새 대본이면 번호를 붙여 새 파일을 만든다
      const files = (await gh(`/contents/${DIR}?ref=${BRANCH}`)).filter((f) => f.name.endsWith(".txt"));
      let path = input.path && files.some((f) => f.path === input.path) ? input.path : null;
      if (!path) {
        const taken = await Promise.all(files.map(async (f) => parseScript(unb64((await gh(`/contents/${f.path}?ref=${BRANCH}`)).content)).meta.id));
        if (taken.includes(id)) throw Object.assign(new Error(`ID "${id}"는 이미 있어요. 다른 ID를 써 주세요.`), { status: 400 });
        const n = files.reduce((m, f) => Math.max(m, parseInt(f.name, 10) || 0), 0) + 1;
        path = `${DIR}/${String(n).padStart(2, "0")}-${id}.txt`;
      }
      const sha = files.find((f) => f.path === path)?.sha;
      const action = input.status === "published" ? "공개" : "초안 저장";
      const r = await gh(`/contents/${path}`, {
        method: "PUT",
        body: JSON.stringify({ message: `content: 명상 '${String(input.title).slice(0, 40)}' ${action} (관리자)`, content: b64(text), sha, branch: BRANCH }),
      });
      return send(res, 200, { ok: true, path, commit: r.commit?.sha });
    }

    if (req.method === "DELETE") {
      const { path, title } = await readBody(req);
      if (!path || !path.startsWith(DIR + "/") || path.includes("..")) throw Object.assign(new Error("지울 대본을 찾지 못했어요."), { status: 400 });
      const f = await gh(`/contents/${path}?ref=${BRANCH}`);
      await gh(`/contents/${path}`, {
        method: "DELETE",
        body: JSON.stringify({ message: `content: 명상 '${String(title || path).slice(0, 40)}' 삭제 (관리자)`, sha: f.sha, branch: BRANCH }),
      });
      return send(res, 200, { ok: true });
    }

    send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) {
    fail(res, e);
  }
}
