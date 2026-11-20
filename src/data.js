// 앱에서 쓰는 고정 데이터: 배경음, 명상 분류, 시간 선택지, 테마

// 목소리 파일은 jsDelivr CDN에서 가져온다 (GitHub 저장소 audio 폴더)
export const CDN = "https://cdn.jsdelivr.net/gh/jeong-jihyun/meditation-app@main/audio/";
const WM = "https://upload.wikimedia.org/wikipedia/commons/transcoded/";

export const BG = {
  none: { label: "배경음 없음", short: "없음", icon: '<path d="M5 5l14 14"/><circle cx="12" cy="12" r="8"/>' },
  forest: {
    label: "숲속 새소리", short: "숲", credit: "De Auditieve Dienst (CC BY-SA 3.0)",
    src: WM + "8/8e/Birds_in_mixed_forest.wav/Birds_in_mixed_forest.wav.mp3",
    icon: '<path d="M12 3c4 3 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 2-7 6-10z"/><path d="M12 21V9M12 13l-3-2.5M12 16l3-2.5"/>',
  },
  rain: {
    label: "창가의 빗소리", short: "빗소리", credit: "cori (퍼블릭 도메인)",
    src: WM + "4/41/Rain_against_the_window.ogg/Rain_against_the_window.ogg.mp3",
    icon: '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.3 3.3 0 0 1 17 15"/><path d="M9 17.5l-1 2.5M13 17.5l-1 2.5M17 17.5l-1 2.5"/>',
  },
  ocean: {
    label: "파도 소리", short: "파도", credit: "Luftrum (CC BY 3.0)",
    src: WM + "f/f1/Oceanwavescrushing.ogg/Oceanwavescrushing.ogg.mp3",
    icon: '<path d="M3 9.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M3 14c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M3 18.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/>',
  },
  bowl: {
    label: "싱잉볼", short: "싱잉볼", credit: "Юкатан (CC BY-SA 3.0)",
    src: WM + "e/e5/Singing_bowl.ogg/Singing_bowl.ogg.mp3",
    icon: '<path d="M3.5 11h17a8.5 7 0 0 1-17 0z"/><path d="M8 20h8"/><path d="M15.5 6.5l3.5-3"/>',
  },
};
export const BG_ORDER = ["none", "forest", "rain", "ocean", "bowl"];

export const CATS = [
  { id: "breath", no: "01", name: "호흡 명상", img: "/img/water.jpg", alt: "물방울이 만든 파동", bg: "ocean",
    desc: "숫자를 따라 숨을 고르며 몸과 마음을 가라앉혀요", tile: ["호흡 명상", "숨을 따라 가라앉기"] },
  { id: "stress", no: "02", name: "스트레스 내려놓기", img: "/img/hanok.jpg", alt: "기와지붕이 보이는 돌담길", bg: "forest",
    desc: "걱정과 긴장을 하나씩 내려놓는 안내 명상", tile: ["마음 내려놓기", "걱정을 흘려보내기"] },
  { id: "words", no: "03", name: "마음에 닿는 글", img: "/img/garden.jpg", alt: "분홍 꽃에 앉은 나비", bg: "rain",
    desc: "지친 하루를 다독이는 짧고 따뜻한 글", tile: ["좋은 글", "나를 다독이는 말"] },
];
export const catOf = (t) => CATS.find((c) => c.id === t?.category) || CATS[0];

// 목소리 안내가 끝난 뒤 배경음을 얼마나 더 틀지 (-1 = 계속)
export const AFTER = [
  { m: 0, l: "목소리와 함께 끄기" }, { m: 10, l: "10분 더" }, { m: 30, l: "30분 더" },
  { m: 60, l: "1시간 더" }, { m: -1, l: "계속 틀어두기" },
];
export const BREATH_LEN = [1, 3, 5];

export const THEMES = [
  { id: "sage", name: "기본", sw: ["#f7f5ef", "#829b83", "#dce7d9"], bar: "#f7f5ef" },
  { id: "blossom", name: "꽃과 나비", sw: ["#fbf5f4", "#c47f93", "#f6e1e7"], bar: "#fbf5f4" },
  { id: "hanji", name: "돌담길", sw: ["#f6f1e7", "#9a8466", "#eee4d2"], bar: "#f6f1e7" },
  { id: "water", name: "물결", sw: ["#f3f7fa", "#6593b8", "#dce9f3"], bar: "#f3f7fa" },
  { id: "night", name: "밤", sw: ["#141917", "#6f8c72", "#2c3732"], bar: "#141917" },
];

// 밤에 추천할 잠들기 좋은 명상
export const NIGHT_TRACKS = ["breath-478", "words-night", "stress-bodyscan"];
