// 모든 화면이 함께 쓰는 틀: 머리글, 하단 탭, 알림, 잠들기 화면
import { useStore } from "../lib/store.js";
import { ui, openScreen, wakeDim } from "../lib/ui.js";
import { player } from "../lib/player.js";
import { NavIcons } from "./Icons.jsx";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "편안한 밤 보내세요" : h < 11 ? "좋은 아침이에요" : h < 18 ? "오늘도 평온하게" : h < 22 ? "오늘 하루 수고했어요" : "편안한 밤 보내세요";
}

export function Header() {
  const p = useStore(player);
  const active = p.track && (p.playing || p.cur > 0);
  return (
    <header>
      <div><div className="brand">MOMENT</div><h1>{greeting()}</h1></div>
      <button className={"now" + (active ? " show" : "")} onClick={() => openScreen("player")}>
        <span className={"eq" + (p.playing ? "" : " paused")}><i /><i /><i /></span>
        <span>{p.track ? (p.playing ? p.track.title : "일시정지") : ""}</span>
      </button>
    </header>
  );
}

const TABS = [["home", "홈"], ["explore", "탐색"], ["player", "명상"], ["mypage", "MY"]];
export function Nav() {
  const { screen } = useStore(ui);
  return (
    <nav className="nav">
      {TABS.map(([id, label]) => (
        <button key={id} data-screen={id} className={screen === id || (screen === "breathing" && id === "player") ? "active" : ""}
          onClick={() => openScreen(id)}>
          {NavIcons[id]}{label}
        </button>
      ))}
    </nav>
  );
}

export function Toast() {
  const { toast } = useStore(ui);
  return <div className={"toast" + (toast ? " show" : "")}>{toast}</div>;
}

export function Dim() {
  const { dimOn } = useStore(ui);
  return <div className={"dim" + (dimOn ? " on" : "")} id="dim" onClick={wakeDim}><p>화면을 누르면 다시 보여요</p></div>;
}
