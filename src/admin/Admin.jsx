// 관리자 화면 (/admin): 대본을 넣고 성우·톤·속도를 골라 명상 콘텐츠를 올린다.
// 저장 → GitHub 저장소에 대본 저장 → GitHub Actions가 목소리 MP3 생성 → 앱에 반영
import { useEffect, useMemo, useRef, useState } from "react";
import { CATS } from "../data.js";
import { mins, useStore } from "../lib/store.js";
import { auth, isAdmin, adminApi, renderGoogleButton, logout } from "../lib/auth.js";
import { applyTheme } from "../lib/settings.js";
import "./admin.css";

const BASE_RATE = -12; // audio/gen.py 와 같은 값 (명상용으로 모든 목소리를 조금 느리게)
const EMPTY = { path: null, id: "", title: "", desc: "", category: "breath", voice: "seoyeon", pitch: 0, rate: 0, gap: 0.9, status: "draft", body: "" };
const STEP_ICON = { completed: "✓", in_progress: "•", queued: "…" };

// 대본으로 대략적인 길이(초)를 계산 (실제 길이는 목소리를 만든 뒤 정확히 나옴)
function estimate(body, speed, gap) {
  let s = 1.5 + 2;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const rest = line.match(/^~(\d+(?:\.\d+)?)$/);
    if (rest) { s += Math.min(60, +rest[1]); continue; }
    if (line.includes(" / ")) {
      const [first, ...counts] = line.split(" / ");
      s += (first.length * 0.19) / speed + 0.4 + counts.length + gap;
    } else s += (line.length * 0.19) / speed + gap;
  }
  return s;
}

const timeAgo = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? "방금" : m < 60 ? m + "분 전" : m < 1440 ? Math.round(m / 60) + "시간 전" : Math.round(m / 1440) + "일 전";
};

export default function Admin() {
  const a = useStore(auth);
  const admin = isAdmin(a);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // 편집 중인 대본 (null이면 목록)
  const [runs, setRuns] = useState(null);
  const [toast, setToast] = useState("");
  const pollRef = useRef(null);
  const wasActive = useRef(false); // 직전에 목소리를 만들고 있었는지

  const say = (t) => { setToast(t); clearTimeout(say.t); say.t = setTimeout(() => setToast(""), 2600); };

  async function load() {
    setBusy(true); setErr("");
    try {
      setData(await adminApi("scripts"));
      refreshRuns();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  async function refreshRuns() {
    try {
      const r = await adminApi("runs");
      setRuns(r);
      const active = !!(r.runs[0] && r.runs[0].status !== "completed");
      clearTimeout(pollRef.current);
      if (active) pollRef.current = setTimeout(refreshRuns, 6000);
      else if (wasActive.current) load(); // 방금 끝났으면 목록(만들어진 소리) 새로 고침
      wasActive.current = active;
    } catch { /* 진행 상황은 못 불러와도 괜찮음 */ }
  }

  useEffect(() => { applyTheme(); return () => clearTimeout(pollRef.current); }, []);
  useEffect(() => { if (admin && !data) load(); }, [admin]); // eslint-disable-line

  if (!a.user) return <Login />;
  if (!admin) return <NotAdmin user={a.user} />;
  if (!data) return (
    <div className="admin admin-login">
      <div className="card">
        <div className="brand">MOMENT · 관리자</div>
        <h1>명상 콘텐츠 관리</h1>
        {err ? <><p className="err">{err}</p><button className="primary-btn wide" onClick={load} disabled={busy}>다시 시도</button></>
          : <p><span className="spin" />불러오는 중이에요…</p>}
      </div>
    </div>
  );

  const open = (s) => setEdit(s ? {
    path: s.path, id: s.meta.id || "", title: s.meta.title || "", desc: s.meta.desc || "",
    category: s.meta.category || "breath", voice: data.voices.some((v) => v.id === s.meta.voice) ? s.meta.voice : "seoyeon",
    pitch: +s.meta.pitch || 0, rate: +s.meta.rate || 0, gap: s.meta.gap ? +s.meta.gap : 0.9,
    status: s.meta.status === "draft" ? "draft" : "published", body: s.body, built: s.built, sha: s.sha,
  } : { ...EMPTY, id: "meditation-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") });

  async function save(form, status) {
    setBusy(true);
    try {
      await adminApi("scripts", { method: "POST", body: JSON.stringify({ ...form, built: undefined, status }) });
      say(status === "published" ? "공개로 저장했어요. 목소리를 만들고 있어요" : "초안으로 저장했어요. 목소리를 만들고 있어요");
      setEdit(null);
      await load();
      setTimeout(refreshRuns, 4000); // GitHub Actions가 시작될 때까지 잠깐 기다림
    } catch (e) { say(e.message); } finally { setBusy(false); }
  }

  async function remove(form) {
    if (!confirm(`'${form.title}' 명상을 지울까요?\n앱에서도 사라지고, 목소리 파일도 함께 지워져요.`)) return;
    setBusy(true);
    try {
      await adminApi("scripts", { method: "DELETE", body: JSON.stringify({ path: form.path, title: form.title }) });
      say("지웠어요"); setEdit(null); await load(); setTimeout(refreshRuns, 4000);
    } catch (e) { say(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="admin">
      <header className="admin-head">
        <div><div className="brand">MOMENT · 관리자</div><h1>{edit ? (edit.path ? "명상 고치기" : "새 명상 만들기") : "명상 콘텐츠 관리"}</h1></div>
        {edit
          ? <button className="pill" onClick={() => setEdit(null)}>목록으로</button>
          : <div className="row-btns"><a className="pill" href="/">앱으로</a><button className="pill" onClick={logout}>로그아웃</button></div>}
      </header>
      <Progress runs={runs} onRefresh={refreshRuns} />
      {edit
        ? <Editor key={edit.path || "new"} init={edit} data={data} busy={busy} onSave={save} onDelete={remove} />
        : <List data={data} busy={busy} onOpen={open} onReload={load} />}
      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </div>
  );
}

function Login() {
  const { error } = useStore(auth);
  const btn = useRef(null);
  useEffect(() => { renderGoogleButton(btn.current); }, []);
  return (
    <div className="admin admin-login">
      <div className="card">
        <div className="brand">MOMENT · 관리자</div>
        <h1>명상 콘텐츠 관리</h1>
        <p>관리자 Google 계정으로 로그인해 주세요.</p>
        <div className="gbtn" ref={btn} />
        {error && <p className="err">{error}</p>}
        <a className="back" href="/">← 명상 앱으로 돌아가기</a>
      </div>
    </div>
  );
}

function NotAdmin({ user }) {
  return (
    <div className="admin admin-login">
      <div className="card">
        <div className="brand">MOMENT · 관리자</div>
        <h1>관리자만 쓸 수 있어요</h1>
        <p><b>{user.email}</b> 계정은 일반 사용자예요. 관리자 계정으로 다시 로그인해 주세요.</p>
        <button className="primary-btn wide" onClick={logout}>다른 계정으로 로그인</button>
        <a className="back" href="/">← 명상 앱으로 돌아가기</a>
      </div>
    </div>
  );
}

// 목소리 만들기 진행 상황 (GitHub Actions)
function Progress({ runs, onRefresh }) {
  const r = runs?.runs?.[0];
  if (!r) return null;
  const active = r.status !== "completed";
  const ok = r.conclusion === "success";
  const label = active ? "목소리를 만들고 있어요" : ok ? "목소리 만들기 완료" : r.conclusion === "cancelled" ? "취소됨 (새 저장이 들어와 다시 시작했을 수 있어요)" : "목소리 만들기 실패";
  return (
    <section className={"card progress-card" + (active ? " active" : ok ? " ok" : " bad")}>
      <div className="row">
        <div>
          <strong>{active && <span className="spin" />}{label}</strong>
          <p>{r.title} · {timeAgo(r.created)}</p>
        </div>
        <div className="row-btns">
          <button className="pill" onClick={onRefresh}>새로 고침</button>
          <a className="pill" href={r.url} target="_blank" rel="noreferrer">자세히</a>
        </div>
      </div>
      {runs.steps?.length > 0 && (
        <ol className="steps">
          {runs.steps.map((s) => (
            <li key={s.name} className={s.status === "completed" ? (s.conclusion === "success" ? "done" : s.conclusion === "skipped" ? "" : "fail") : s.status === "in_progress" ? "now" : ""}>
              <i>{s.status === "completed" && s.conclusion !== "success" && s.conclusion !== "skipped" ? "!" : STEP_ICON[s.status] || ""}</i>{s.name}
            </li>
          ))}
        </ol>
      )}
      {active && <p className="hint">대본 길이에 따라 1~5분 걸려요. 이 화면은 저절로 새로 고쳐져요.</p>}
    </section>
  );
}

function List({ data, busy, onOpen, onReload }) {
  const by = (c) => data.scripts.filter((s) => (s.meta.category || "breath") === c);
  const vname = (id) => data.voices.find((v) => v.id === id)?.name || "서연";
  return (
    <>
      <div className="row list-top">
        <p>모두 {data.scripts.length}편 · 공개 {data.scripts.filter((s) => s.meta.status !== "draft").length}편</p>
        <div className="row-btns">
          <button className="pill" onClick={onReload} disabled={busy}>{busy ? "불러오는 중…" : "새로 고침"}</button>
          <button className="primary-btn" onClick={() => onOpen(null)}>+ 새 명상</button>
        </div>
      </div>
      {CATS.map((c) => (
        <section className="category admin-cat" key={c.id}>
          <div className="copy">
            <h3>{c.no}. {c.name}</h3>
            {by(c.id).length === 0 && <p>아직 명상이 없어요.</p>}
            {by(c.id).map((s) => {
              const draft = s.meta.status === "draft";
              return (
                <button className="admin-item" key={s.path} onClick={() => onOpen(s)}>
                  <span className="t">
                    <strong>{s.meta.title}</strong>
                    <small>{vname(s.meta.voice)} · {s.built ? mins(s.built.duration) : "목소리 준비 중"} · {s.meta.id}</small>
                  </span>
                  <em className={"badge" + (draft ? " draft" : "")}>{draft ? "초안" : "공개"}</em>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

function Slider({ label, value, min, max, step, onChange, left, right, show }) {
  return (
    <label className="slider">
      <span className="row"><b>{label}</b><em>{show(value)}</em></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="row ends"><small>{left}</small><button type="button" className="reset" onClick={() => onChange(min < 0 ? 0 : 0.9)}>기본값</button><small>{right}</small></span>
    </label>
  );
}

function Editor({ init, data, busy, onSave, onDelete }) {
  const [f, setF] = useState(init);
  const [gender, setGender] = useState("all");
  const [playing, setPlaying] = useState(null);
  const sampleRef = useRef(null);
  const bodyRef = useRef(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));

  const preset = data.voices.find((v) => v.id === f.voice) || data.voices[0];
  const speed = 1 + (BASE_RATE + (preset?.rate || 0) + f.rate) / 100;
  const est = useMemo(() => estimate(f.body, speed, f.gap), [f.body, speed, f.gap]);
  const voices = data.voices.filter((v) => gender === "all" || v.gender === gender);
  // 마지막으로 만든 소리와 지금 설정이 같은지 (다르면 저장해야 새 소리가 나옴)
  const built = init.built;
  const changed = built && (JSON.stringify({ ...f, status: 0 }) !== JSON.stringify({ ...init, status: 0 }));

  function playSample(v) {
    const a = sampleRef.current;
    if (playing === v.id) { a.pause(); setPlaying(null); return; }
    const s = data.samples[v.id];
    if (!s) { alert("이 성우의 샘플은 아직 만들어지지 않았어요. 잠시 뒤 새로 고침해 주세요."); return; }
    a.src = data.cdn + s.file + "?v=" + s.hash;
    a.preservesPitch = true;
    a.playbackRate = Math.max(0.5, Math.min(2, 1 + (v.rate + f.rate) / 100)); // 속도만 미리 맞춰 들려줌
    a.play().catch(() => {});
    setPlaying(v.id);
  }

  function insert(text) {
    const el = bodyRef.current;
    const s = el.selectionStart ?? f.body.length, e = el.selectionEnd ?? s;
    const before = f.body.slice(0, s), after = f.body.slice(e);
    const pre = before && !before.endsWith("\n") ? "\n" : "";
    const next = before + pre + text + "\n" + after.replace(/^\n/, "");
    setF((x) => ({ ...x, body: next }));
    requestAnimationFrame(() => { el.focus(); const p = (before + pre + text + "\n").length; el.setSelectionRange(p, p); });
  }

  const missing = !f.title.trim() ? "제목" : f.body.trim().length < 5 ? "대본" : !/^[a-z0-9][a-z0-9-]{1,39}$/.test(f.id) ? "ID" : "";

  return (
    <div className="editor">
      <audio ref={sampleRef} onEnded={() => setPlaying(null)} />

      <section className="card">
        <h2>기본 정보</h2>
        <label className="lbl">제목<input className="field" value={f.title} onChange={set("title")} maxLength={60} placeholder="예: 빗소리와 함께 잠드는 호흡" /></label>
        <label className="lbl">짧은 설명<input className="field" value={f.desc} onChange={set("desc")} maxLength={120} placeholder="목록에 보이는 한 줄 설명" /></label>
        <label className="lbl">ID <small>영문 소문자·숫자·하이픈, 파일 이름이 돼요{f.path ? " (만든 뒤에는 바꿀 수 없어요)" : ""}</small>
          <input className="field mono" value={f.id} disabled={!!f.path} onChange={(e) => set("id")(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} />
        </label>
        <div className="lbl">분류</div>
        <div className="chips">
          {CATS.map((c) => <button type="button" key={c.id} className={"chip" + (f.category === c.id ? " on" : "")} onClick={() => set("category")(c.id)}>{c.name}</button>)}
        </div>
      </section>

      <section className="card">
        <div className="row"><h2>성우</h2>
          <div className="chips small">
            {[["all", "전체"], ["female", "여성"], ["male", "남성"]].map(([g, l]) => (
              <button type="button" key={g} className={"chip" + (gender === g ? " on" : "")} onClick={() => setGender(g)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="voices">
          {voices.map((v) => (
            <div key={v.id} className={"voice" + (f.voice === v.id ? " on" : "")} onClick={() => set("voice")(v.id)} role="button" tabIndex={0}>
              <span className={"avatar " + v.gender}>{v.name.slice(0, 1)}</span>
              <span className="t"><strong>{v.name} <small>{v.gender === "female" ? "여성" : "남성"}</small></strong><small>{v.desc}</small></span>
              <button type="button" className="listen" onClick={(e) => { e.stopPropagation(); playSample(v); }} aria-label={v.name + " 샘플 듣기"}>
                {playing === v.id ? "■" : "▶"}
              </button>
            </div>
          ))}
        </div>
        <p className="hint">▶ 샘플은 고른 속도로 들려줘요. 톤은 저장한 뒤 만들어진 소리로 확인할 수 있어요.</p>
        <Slider label="톤 (높낮이)" value={f.pitch} min={-10} max={10} step={1} onChange={set("pitch")} left="낮게" right="높게" show={(v) => (v > 0 ? "+" : "") + v} />
        <Slider label="말하는 속도" value={f.rate} min={-30} max={20} step={2} onChange={set("rate")} left="느리게" right="빠르게" show={(v) => (v > 0 ? "+" : "") + v + "%"} />
        <Slider label="문장 사이 쉼" value={f.gap} min={0.4} max={3} step={0.1} onChange={set("gap")} left="짧게" right="길게" show={(v) => v.toFixed(1) + "초"} />
      </section>

      <section className="card">
        <div className="row"><h2>대본</h2><em className="est">예상 {mins(est)}</em></div>
        <div className="chips small tools">
          <button type="button" className="chip" onClick={() => insert("~3")}>+ 3초 쉬기</button>
          <button type="button" className="chip" onClick={() => insert("~10")}>+ 10초 쉬기</button>
          <button type="button" className="chip" onClick={() => insert("천천히 들이쉬세요. / 하나 / 둘 / 셋 / 넷")}>+ 숫자 세기</button>
        </div>
        <textarea ref={bodyRef} className="field script" value={f.body} onChange={set("body")}
          placeholder={"한 줄에 한 문장씩 써 주세요.\n\n안녕하세요. 지금부터 숨에 집중해 볼게요.\n~3\n천천히 들이쉬세요. / 하나 / 둘 / 셋 / 넷"} />
        <p className="hint">한 줄 = 한 번 말하기 · <b>~5</b> = 5초 쉬기 · <b>문장 / 하나 / 둘</b> = 숫자를 1초씩 세기</p>
      </section>

      {built && (
        <section className="card">
          <h2>만들어진 소리</h2>
          <p>{built.voiceName || preset?.name} · 톤 {built.pitch || "-"} · 속도 {built.rate || "-"} · {mins(built.duration)}</p>
          <audio className="built" controls preload="none" src={data.cdn + built.file + "?v=" + built.hash} />
          {changed && <p className="warn">설정이나 대본을 바꿨어요. 저장하면 새 소리를 만들어요.</p>}
        </section>
      )}

      <div className="actions">
        {missing && <p className="warn">{missing}을(를) 넣어 주세요.</p>}
        <button className="pill" disabled={busy || !!missing} onClick={() => onSave(f, "draft")}>{busy ? "저장 중…" : "초안 저장 (앱에 안 보임)"}</button>
        <button className="primary-btn" disabled={busy || !!missing} onClick={() => onSave(f, "published")}>{busy ? "저장 중…" : f.status === "published" && f.path ? "저장 (공개 유지)" : "공개하기"}</button>
        {f.path && <button className="danger" disabled={busy} onClick={() => onDelete(f)}>삭제</button>}
      </div>
    </div>
  );
}
