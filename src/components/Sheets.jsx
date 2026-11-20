// 아래에서 올라오는 설정 창: 시간 설정, 배경음 설정
import { useStore } from "../lib/store.js";
import { ui, closeSheet } from "../lib/ui.js";
import { player, setAfter, setBg, setVVol, setBVol } from "../lib/player.js";
import { AFTER, BG, BG_ORDER } from "../data.js";
import { PathIcon, VolLow, VolHigh } from "./Icons.jsx";

function Sheet({ id, children }) {
  const { sheet } = useStore(ui);
  return (
    <div className={"sheet" + (sheet === id ? " open" : "")} id={id}>
      <div className="grab" />
      {children}
      <button className="primary-btn" style={{ width: "100%", marginTop: 20 }} onClick={closeSheet}>확인</button>
    </div>
  );
}

export function Sheets() {
  const { sheet } = useStore(ui);
  const p = useStore(player);
  return (
    <>
      <div className={"sheet-bg" + (sheet ? " open" : "")} onClick={closeSheet} />

      <Sheet id="timeSheet">
        <h3>시간 설정</h3>
        <p>목소리 안내가 끝난 뒤, 배경음을 얼마나 더 들을지 정해요. 잠들 때 쓰기 좋아요.</p>
        <div className="chips" style={{ marginTop: 14 }}>
          {AFTER.map((a) => (
            <button key={a.m} className={"chip" + (a.m === p.after ? " on" : "")} data-m={a.m} onClick={() => setAfter(a.m)}>{a.l}</button>
          ))}
        </div>
      </Sheet>

      <Sheet id="soundSheet">
        <h3>배경음 설정</h3>
        <p>목소리 뒤에 잔잔하게 깔리는 자연의 소리예요.</p>
        <div className="sound-list">
          {BG_ORDER.map((k) => (
            <button key={k} className={"sound-opt" + (k === p.bg ? " on" : "")} onClick={() => setBg(k)}>
              <PathIcon d={BG[k].icon} />
              <span><b>{BG[k].short}</b><small>{BG[k].label}</small></span>
            </button>
          ))}
        </div>
        <div className="vol-label">목소리 크기</div>
        <div className="vol-row">
          <VolLow />
          <input type="range" min="0" max="1" step="0.01" value={p.vVol} aria-label="목소리 크기" onChange={(e) => setVVol(+e.target.value)} />
          <VolHigh />
        </div>
        <div className="vol-label">배경음 크기</div>
        <div className="vol-row">
          <VolLow />
          <input type="range" min="0" max="1" step="0.01" value={p.bVol} aria-label="배경음 크기" onChange={(e) => setBVol(+e.target.value)} />
          <VolHigh />
        </div>
        <p style={{ fontSize: 11 }}>아이폰은 크기 조절 막대가 동작하지 않아요. 기기 옆 음량 버튼을 써 주세요.</p>
      </Sheet>
    </>
  );
}
