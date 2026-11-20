import { useStore, mins } from "../lib/store.js";
import { player, pickTrack, todayPick } from "../lib/player.js";
import { openScreen, toast } from "../lib/ui.js";
import { CATS, catOf } from "../data.js";

export default function Home() {
  const { tracks } = useStore(player);
  const t = todayPick(tracks);
  const c = t ? catOf(t) : CATS[0];
  const goCat = (id) => {
    openScreen("explore");
    setTimeout(() => document.getElementById("cat-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  return (
    <>
      <h2>잠시 멈춰도 괜찮아요.</h2><p>지금 이 순간, 나에게 집중해 보세요.</p>
      <div className="hero" onClick={() => t && pickTrack(t.id, false)}>
        <img src={c.img} alt={c.alt} />
        <div className="hero-label">
          <strong>{t ? t.title : "목소리 명상을 준비하고 있어요"}</strong>
          <span>{t ? `오늘의 추천 · ${mins(t.duration)} 음성 명상` : "잠시 뒤 다시 열어 주세요"}</span>
        </div>
      </div>
      <div className="feature">
        <small>오늘의 추천 명상</small>
        <h2>{t ? t.desc : "목소리로 안내하는 명상"}</h2>
        <small>{t ? `${mins(t.duration)} · ${c.name}` : "준비 중"}</small><br />
        <button className="pill" onClick={() => (t ? pickTrack(t.id, true) : toast("음성을 준비하고 있어요. 잠시 뒤 다시 열어 주세요"))}>명상 시작 →</button>
      </div>
      <div className="section-head">
        <h2>당신을 위한 명상</h2>
        <button onClick={() => openScreen("explore")} style={{ background: "none", color: "var(--primary-dark)", fontSize: 12 }}>전체 보기</button>
      </div>
      <div className="tiles">
        {CATS.filter((x) => x.id !== (t ? c.id : "")).slice(0, 2).map((x) => (
          <article className="tile" key={x.id} data-id={x.id} onClick={() => goCat(x.id)}>
            <img src={x.img} alt={x.alt} />
            <div><h3>{x.tile[0]}</h3><p>{x.tile[1]}</p></div>
          </article>
        ))}
      </div>
    </>
  );
}
