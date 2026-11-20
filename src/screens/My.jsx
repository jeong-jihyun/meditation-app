import { useEffect, useRef } from "react";
import { useStore } from "../lib/store.js";
import { records, stats, resetLog, dayKey } from "../lib/records.js";
import { settings, toggleSetting, chooseTheme, isNightHour } from "../lib/settings.js";
import { player, keepAwake, releaseAwake } from "../lib/player.js";
import { toast, armDim, clearDim } from "../lib/ui.js";
import { THEMES } from "../data.js";
import { auth, checkLogin, renderGoogleButton, logout } from "../lib/auth.js";

// 계정: 로그인은 선택. 관리자 계정이면 콘텐츠 관리로 갈 수 있다
function Account() {
  const a = useStore(auth);
  const btn = useRef(null);
  useEffect(() => { checkLogin(); }, []);
  useEffect(() => { if (a.enabled && !a.user) renderGoogleButton(btn.current); }, [a.enabled, a.user]);
  if (!a.user && !a.enabled) return null; // 로그인 설정 전에는 숨김
  return (
    <>
      <h3 style={{ margin: "26px 0 0" }}>계정</h3>
      {a.user ? (
        <div className="account">
          <div className="who">
            {a.user.picture ? <img src={a.user.picture} alt="" referrerPolicy="no-referrer" /> : <span className="ph">{(a.user.name || "?").slice(0, 1)}</span>}
            <span className="t"><b>{a.user.name}</b><small>{a.user.email}</small></span>
            <span className={"badge" + (a.user.role === "admin" ? "" : " plain")}>{a.user.role === "admin" ? "관리자" : "일반 사용자"}</span>
          </div>
          <div className="acts">
            {a.user.role === "admin" && <a className="primary-btn" href="/admin">콘텐츠 관리</a>}
            <button className="chip" onClick={() => { logout(); toast("로그아웃했어요"); }}>로그아웃</button>
          </div>
        </div>
      ) : (
        <div className="account">
          <p style={{ marginTop: 0 }}>로그인하지 않아도 모든 명상을 들을 수 있어요.</p>
          <div className="gbtn" ref={btn} />
          {a.error && <p style={{ color: "#b4483c", fontSize: 12 }}>{a.error}</p>}
        </div>
      )}
    </>
  );
}

const Toggle = ({ on }) => <span className={"toggle" + (on ? " on" : "")} />;

export default function My() {
  const { log } = useStore(records);
  const s = useStore(settings);
  const { days, total, streak, week } = stats(log);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60);
  const max = Math.max(600, ...week.map((w) => w.v));
  const today = dayKey();
  const resetArmed = useRef(0);

  const toggle = (k) => {
    toggleSetting(k);
    const v = settings.get()[k], playing = player.get().playing;
    if (k === "awake") v && playing ? keepAwake() : releaseAwake();
    if (k === "dim") v && playing ? armDim() : clearDim();
    toast(v ? "켰어요" : "껐어요");
  };
  const pickTheme = (t) => {
    chooseTheme(t.id);
    toast(s.autoNight && isNightHour() && t.id !== "night" ? `'${t.name}' 테마는 아침 6시부터 보여요` : `'${t.name}' 테마로 바꿨어요`);
  };
  const reset = () => {
    if (Date.now() - resetArmed.current > 3000) { resetArmed.current = Date.now(); toast("한 번 더 누르면 기록이 모두 지워져요"); return; }
    resetLog(); resetArmed.current = 0; toast("기록을 지웠어요");
  };

  return (
    <>
      <h2>나의 명상 기록</h2><p>조금씩 쌓아가는 나만의 평온한 시간</p>
      <div className="feature" style={{ background: "var(--card-soft)", color: "var(--text)" }}>
        <small style={{ color: "var(--primary-dark)" }}>누적 명상 시간</small>
        <h2 style={{ color: "var(--text)", fontSize: 30 }}>{h ? `${h}시간 ${m}분` : `${m}분`}</h2>
        <small style={{ color: "var(--muted)" }}>
          {days.length ? `${days[0].replace(/-/g, ".")}부터 이 기기에 쌓인 기록` : "명상을 1분 이상 하면 기록이 쌓여요"}
        </small>
      </div>
      <div className="stats">
        <div className="stat"><strong>{days.length}일</strong><p>총 명상 일수</p></div>
        <div className="stat"><strong>{streak}일</strong><p>연속 실천</p></div>
      </div>
      <h3 style={{ margin: "22px 0 12px" }}>이번 주 명상 활동</h3>
      <div className="chart">
        {week.map((w) => (
          <div key={w.k} className={"bar" + (w.v < 60 ? " empty" : "") + (w.k === today ? " today" : "")}
            style={{ height: Math.max(3, (w.v / max) * 100) + "%" }} title={Math.round(w.v / 60) + "분"}>
            <span>{w.l}</span>
          </div>
        ))}
      </div>

      <h3 style={{ margin: "26px 0 0" }}>테마</h3><p>배치는 그대로, 앱의 색만 바뀌어요.</p>
      <div className="themes">
        {THEMES.map((t) => (
          <button key={t.id} className={"theme-opt" + (t.id === s.theme ? " on" : "")} data-id={t.id} onClick={() => pickTheme(t)}>
            <span className="sw">{t.sw.map((c) => <i key={c} style={{ background: c }} />)}</span>{t.name}
          </button>
        ))}
      </div>

      <Account />

      <div style={{ marginTop: 18 }}>
        <button className="setting" onClick={() => toggle("autoNight")}>밤 9시~아침 6시는 밤 테마<Toggle on={s.autoNight} /></button>
        <button className="setting" onClick={() => toggle("awake")}>재생 중 화면 켜두기<Toggle on={s.awake} /></button>
        <button className="setting" onClick={() => toggle("dim")}>재생 중 화면 어둡게 (잠들기)<Toggle on={s.dim} /></button>
        <button className="setting" onClick={reset}>명상 기록 지우기<span style={{ color: "var(--muted)" }}>›</span></button>
      </div>
    </>
  );
}
