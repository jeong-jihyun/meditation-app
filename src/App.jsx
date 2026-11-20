import { useEffect } from "react";
import { useStore } from "./lib/store.js";
import { ui, armDim } from "./lib/ui.js";
import { player, loadTracks, prepareDefault } from "./lib/player.js";
import { applyTheme } from "./lib/settings.js";
import { flushLog } from "./lib/records.js";
import { Header, Nav, Toast, Dim } from "./components/Chrome.jsx";
import { Sheets } from "./components/Sheets.jsx";
import Home from "./screens/Home.jsx";
import Explore from "./screens/Explore.jsx";
import Player from "./screens/Player.jsx";
import Breathing from "./screens/Breathing.jsx";
import My from "./screens/My.jsx";

const SCREENS = [["home", Home], ["explore", Explore], ["player", Player], ["breathing", Breathing], ["mypage", My]];

export default function App() {
  const { screen } = useStore(ui);

  useEffect(() => {
    applyTheme();
    const themeTimer = setInterval(applyTheme, 60000); // 밤 9시·아침 6시 자동 전환
    loadTracks().then(prepareDefault);
    // 재생 중 화면을 만지면 '어둡게' 시간을 다시 센다
    const onTouch = () => { if (player.get().playing && !ui.get().dimOn) armDim(); };
    document.addEventListener("pointerdown", onTouch, { passive: true });
    return () => { clearInterval(themeTimer); document.removeEventListener("pointerdown", onTouch); };
  }, []);

  useEffect(() => { if (screen === "mypage") flushLog(); }, [screen]);

  return (
    <div className="app">
      <Header />
      <main>
        {/* 화면은 모두 그려 두고 보이는 것만 바꾼다 (호흡·재생 상태 유지) */}
        {SCREENS.map(([id, Comp]) => (
          <section key={id} id={id} className={"screen" + (screen === id ? " active" : "")}><Comp /></section>
        ))}
      </main>
      <Nav />
      <Sheets />
      <Dim />
      <Toast />
    </div>
  );
}
