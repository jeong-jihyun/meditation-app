// 관리자: 음성 만들기(GitHub Actions voice.yml) 진행 상황
// 가장 최근 실행 5개와, 진행 중인 실행의 단계별 상태를 돌려준다.
import { guard, gh, send, fail } from "./_lib.js";

const STEP_NAMES = {
  "도구 설치 (edge-tts, ffmpeg)": "준비",
  "대본을 음성으로 만들기": "목소리 만들기",
  "만든 음성 파일 올리기": "파일 올리기",
  "CDN(jsDelivr) 캐시 새로 고치기": "앱에 반영",
};

export default async function handler(req, res) {
  if (!(await guard(req, res))) return;
  try {
    const data = await gh("/actions/workflows/voice.yml/runs?per_page=5&branch=main");
    const runs = (data.workflow_runs || []).map((r) => ({
      id: r.id, status: r.status, conclusion: r.conclusion, url: r.html_url,
      title: r.display_title || r.head_commit?.message?.split("\n")[0] || "",
      created: r.created_at, updated: r.updated_at,
    }));
    // 맨 위 실행의 단계 (진행 중이면 어디까지 왔는지 보여 주기)
    let steps = [];
    if (runs[0]) {
      const jobs = await gh(`/actions/runs/${runs[0].id}/jobs`);
      steps = (jobs.jobs?.[0]?.steps || [])
        .filter((s) => STEP_NAMES[s.name])
        .map((s) => ({ name: STEP_NAMES[s.name], status: s.status, conclusion: s.conclusion }));
    }
    send(res, 200, { runs, steps });
  } catch (e) {
    fail(res, e);
  }
}
