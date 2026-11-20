# MOMENT — 나에게 집중하는 시간

사람 목소리로 안내하는 수면·마음챙김 명상 웹앱입니다.
`moment_meditation_design.html` 디자인 시스템(세이지 그린, 흰 카드, 하단 4탭)을 기준으로 만들었습니다.

- 앱 주소: https://meditation-app-one-iota.vercel.app/

## 음성 명상 (6편)
| 분류 | 제목 | 내용 |
|---|---|---|
| 호흡 명상 | 편안한 4·6 호흡 | 4초 들이쉬고 6초 내쉬기 |
| 호흡 명상 | 잠이 오는 4·7·8 호흡 | 잠들기 전 누워서 하는 느린 호흡 |
| 스트레스 내려놓기 | 걱정 내려놓기 | 생각을 나뭇잎에 실어 흘려보내기 |
| 스트레스 내려놓기 | 몸 구석구석 풀어주기 | 머리부터 발끝까지 이완 |
| 마음에 닿는 글 | 오늘의 나에게 | 지친 마음을 다독이는 짧은 글 7편 |
| 마음에 닿는 글 | 잠들기 전 마음 정리 | 고마운 일 떠올리며 잠들기 |

## 코드 구조 (Vite + React)
```
src/
  main.jsx, App.jsx        앱 시작 · 화면 전환
  data.js                  배경음 · 명상 분류 · 테마 등 고정 데이터
  styles.css               MOMENT 디자인 시스템 (테마는 색 변수만 바꿈)
  lib/player.js            소리 엔진 (목소리 + 배경음, 15초 이동, 끝난 뒤 배경음 타이머)
  lib/records.js           이 기기에 저장되는 명상 기록
  lib/settings.js          설정 · 테마
  lib/ui.js                화면 이동 · 설정 창 · 알림 · 잠들기 화면
  components/              머리글 · 하단 탭 · 아이콘 · 설정 창
  screens/                 홈 · 탐색 · 명상 · 호흡 · MY
public/img/                사진
audio/                     명상 대본 · 음성 생성기 · 만들어진 음성(CDN으로 제공)
```
- 개발: `npm install` 후 `npm run dev`
- 배포: GitHub에 올리면 Vercel이 `npm run build`로 자동 배포 (`vercel.json`)

## 음성이 만들어지는 방식
1. 대본은 `audio/scripts/*.txt` 에 있습니다. (`~5` = 5초 쉬기, ` / ` = 1초씩 숫자 세기)
2. 대본이 바뀌어 GitHub에 올라가면 GitHub Actions(`.github/workflows/voice.yml`)가
   `audio/gen.py` 로 사람 목소리 MP3를 만들어 `audio/files/` 에 올립니다. (목소리: Microsoft SunHi, 무료)
3. 앱은 jsDelivr CDN(`cdn.jsdelivr.net/gh/jeong-jihyun/meditation-app@main/audio/`)에서 음성을 받아 재생합니다.
   CDN이 안 될 때는 앱 서버(Vercel)의 같은 파일을 씁니다.

대본만 고치면 음성은 자동으로 다시 만들어집니다.

## 앱 기능
- 목소리 + 배경음(숲·빗소리·파도·싱잉볼) 함께 재생, 크기 따로 조절
- 15초 뒤로/앞으로, 진행 막대 눌러 이동
- 안내가 끝난 뒤 배경음 10분·30분·1시간·계속 (잠들기용)
- 눈으로 따라 하는 호흡(4초/6초, 1·3·5분)
- 이 기기에 저장되는 명상 기록(누적 시간, 일수, 연속 일수, 이번 주 그래프)
- 화면 켜두기, 잠들기 화면, 잠금화면 재생 조작

## 배경음 출처 (Wikimedia Commons)
- 숲속 새소리 — De Auditieve Dienst (CC BY-SA 3.0)
- 창가의 빗소리 — cori (퍼블릭 도메인)
- 파도 소리 — Luftrum (CC BY 3.0)
- 싱잉볼 — Юкатан (CC BY-SA 3.0)
