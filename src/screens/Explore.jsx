import { useStore, mins } from "../lib/store.js";
import { player, pickTrack, togglePlay } from "../lib/player.js";
import { openScreen, toast } from "../lib/ui.js";
import { CATS } from "../data.js";
import { PlayIcon, PauseIcon } from "../components/Icons.jsx";

export default function Explore() {
  const p = useStore(player);
  const onTrack = (id) => (p.track?.id === id ? togglePlay() : pickTrack(id, true));
  return (
    <>
      <h2>어떤 시간을 보내고 싶나요?</h2><p>목소리를 따라 천천히 들어 보세요.</p>
      {CATS.map((c) => {
        const list = p.tracks.filter((t) => t.category === c.id);
        const first = list[0];
        return (
          <article className="category" id={"cat-" + c.id} key={c.id}>
            <img src={c.img} alt={c.alt} />
            <div className="copy">
              <div className="row">
                <h3>{c.no}. {c.name}</h3>
                <button data-first={c.id} onClick={() => (first ? pickTrack(first.id, false) : toast("음성을 준비하고 있어요"))}>선택</button>
              </div>
              <p>{c.desc}</p>
              <div className="tracks">
                {list.length ? list.map((t) => {
                  const on = p.track?.id === t.id;
                  return (
                    <button key={t.id} className={"track" + (on ? " on" : "")} data-id={t.id} onClick={() => onTrack(t.id)}>
                      <span className="t">
                        <b>{t.title}<span className="badge">{mins(t.duration)}</span></b>
                        <small>{t.desc}</small>
                      </span>
                      <span className="go">{on && p.playing ? <PauseIcon /> : <PlayIcon />}</span>
                    </button>
                  );
                }) : <p style={{ padding: "10px 0 2px" }}>{p.loaded ? "음성을 준비하고 있어요." : "불러오는 중이에요."}</p>}
                {c.id === "breath" && (
                  <button className="track" data-breath="1" onClick={() => openScreen("breathing")}>
                    <span className="t"><b>눈으로 따라 하는 호흡</b><small>원이 커지고 작아지는 속도에 맞춰 숨 쉬기 · 1~5분</small></span>
                    <span className="go"><PlayIcon /></span>
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
