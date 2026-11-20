import { useStore, fmt } from "../lib/store.js";
import { player, togglePlay, seekBy, seekTo } from "../lib/player.js";
import { openScreen, openSheet } from "../lib/ui.js";
import { BG } from "../data.js";
import { BackIcon, MoreIcon, Back15, Fwd15, PlayIcon, PauseIcon } from "../components/Icons.jsx";

export default function Player() {
  const p = useStore(player);
  const { track: t, cat: c } = p;
  const d = p.dur || t?.duration || 0;

  // 안내가 끝난 뒤 배경음만 흐를 때는 남은 시간을 보여 준다
  let now = fmt(p.cur), end = fmt(d), width = d ? Math.min(100, (p.cur / d) * 100) : 0;
  if (p.voiceDone && p.playing) {
    now = "안내 끝";
    end = p.after < 0 ? "배경음 계속" : `${fmt((p.afterEnd - Date.now()) / 1000)} 후 꺼짐`;
    width = 100;
  }
  const onProgress = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
  };
  const bgc = BG[p.bg].credit ? `배경음 ${BG[p.bg].credit} · ` : "";

  return (
    <>
      <div className="row" style={{ margin: "4px 0 16px" }}>
        <button className="icon-btn" onClick={() => openScreen("explore")} aria-label="뒤로"><BackIcon /></button>
        <p>{t ? c.name : "음성 명상"}</p>
        <button className="icon-btn" onClick={() => openSheet("soundSheet")} aria-label="소리 설정"><MoreIcon /></button>
      </div>
      <img className="player-art" src={c.img} alt={c.alt} />
      <div className="player-title">
        <h2>{t ? t.title : "명상을 골라 주세요"}</h2>
        <p>{t ? t.desc : "탐색 탭에서 듣고 싶은 명상을 골라 주세요."}</p>
      </div>
      <div className="row"><small>{now}</small><small>{end}</small></div>
      <div className="progress" onClick={onProgress}><span style={{ width: width + "%" }} /></div>
      <div className="controls">
        <button onClick={() => seekBy(-15)} aria-label="15초 뒤로"><Back15 /><em>15</em></button>
        <button className="play" id="playBtn" onClick={togglePlay} aria-label={p.playing ? "일시정지" : "재생"}>
          {p.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button onClick={() => seekBy(15)} aria-label="15초 앞으로"><Fwd15 /><em>15</em></button>
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <button className="primary-btn" id="timeBtn" onClick={() => openSheet("timeSheet")}>
          끝난 뒤 · {p.after === 0 ? "끄기" : p.after < 0 ? "계속" : p.after + "분"}
        </button>
        <button className="primary-btn" id="soundBtn" onClick={() => openSheet("soundSheet")}>배경음 · {BG[p.bg].short}</button>
      </div>
      <p className="credit" style={{ marginTop: 20 }}>
        목소리: Microsoft 음성 합성(SunHi) · {bgc}
        <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a>
      </p>
    </>
  );
}
