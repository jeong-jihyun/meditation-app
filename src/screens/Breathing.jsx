// 눈으로 따라 하는 호흡: 4초 들숨 · 6초 날숨
import { useEffect, useRef, useState } from "react";
import { useStore, fmt, saved, fade, dispose } from "../lib/store.js";
import { player } from "../lib/player.js";
import { addLog } from "../lib/records.js";
import { toast } from "../lib/ui.js";
import { BG, BREATH_LEN } from "../data.js";

const PHASES = [["들이쉬기", 4, "inhale"], ["내쉬기", 6, "exhale"]];

export default function Breathing() {
  const { bVol } = useStore(player);
  const [len, setLen] = useState(() => saved.get("blen", 3));
  const [on, setOn] = useState(false);
  const [view, setView] = useState({ text: "준비", cls: "", left: len * 60, note: "남은 호흡 시간" });
  const r = useRef({ iv: null, a: null, phase: 0, remain: 4, left: 0 });

  const stop = (done) => {
    const s = r.current;
    clearInterval(s.iv); s.iv = null;
    if (s.a) { const a = s.a; s.a = null; fade(a, 0, 1500, () => dispose(a)); }
    setOn(false);
    setView({ text: done ? "잘했어요" : "준비", cls: "", left: len * 60, note: "남은 호흡 시간" });
    if (done) toast(`${len}분 호흡을 마쳤어요`);
  };

  const start = () => {
    const s = r.current;
    s.phase = 0; s.remain = 4; s.left = len * 60;
    let note = "남은 호흡 시간 · 명상 재생 중";
    if (!player.get().playing) { // 다른 명상을 듣는 중이 아니면 파도 소리를 잔잔하게
      const a = new Audio(BG.ocean.src); a.loop = true; a.volume = 0; s.a = a;
      a.play().then(() => fade(a, bVol, 2000)).catch(() => {});
      note = "남은 호흡 시간 · 파도 소리와 함께";
    }
    setOn(true);
    const step = () => {
      const [label, , cls] = PHASES[s.phase];
      setView({ text: `${label} ${s.remain}초`, cls, left: s.left, note });
      if (!player.get().playing) addLog(1);
      s.remain--; s.left--;
      if (s.remain < 1) { s.phase = (s.phase + 1) % 2; s.remain = PHASES[s.phase][1]; }
      if (s.left < 0) stop(true);
    };
    step();
    s.iv = setInterval(step, 1000);
  };

  useEffect(() => () => { clearInterval(r.current.iv); dispose(r.current.a); }, []);

  const pickLen = (m) => { if (on) return; setLen(m); saved.set("blen", m); setView((v) => ({ ...v, left: m * 60 })); };

  return (
    <div className="breath-wrap">
      <h2>호흡에 집중하세요.</h2><p>4초 들이쉬고, 6초 내쉬어 보세요.</p>
      <div className={"breath-orb " + view.cls} id="orb"><span>{view.text}</span></div>
      <h2>{fmt(view.left)}</h2><p>{view.note}</p>
      <div className="chips" style={{ justifyContent: "center", margin: "6px 0 18px", opacity: on ? 0.45 : 1 }}>
        {BREATH_LEN.map((m) => (
          <button key={m} className={"chip" + (m === len ? " on" : "")} onClick={() => pickLen(m)}>{m}분</button>
        ))}
      </div>
      <button className="primary-btn" id="breathBtn" onClick={() => (on ? stop(false) : start())}>{on ? "호흡 중지" : "호흡 시작"}</button>
    </div>
  );
}
