// ⚡ 반응속도 공통: 판 이름, 기록판 집계, 순위 (서버 _reaction_rank와 같은 기준 — 표시용)
export const MAIN = [1, 2, 3];
export const MIN_MS = 100; // 이보다 빠르면 부정출발
export const REVEAL_GAP = 2000; // 결과 공개 3위 → 2위 → 1위 간격

export const trialLabel = no => (no <= 3 ? `본게임 ${no} / 3` : `동점 추가판 ${no - 3}`); // LIVE는 연습 판 없음

// trials: reaction_trials 행들 → { [user]: { cells: {trial_no: ms}, avg, best, extra: [ms] } }
export function boardOf(trials) {
  const by = {};
  for (const t of trials) {
    if (t.reaction_ms === null || t.voided || t.false_start) continue;
    const u = (by[t.user_id] ||= { cells: {}, extra: [] });
    u.cells[t.trial_no] = t.reaction_ms;
  }
  for (const u of Object.values(by)) {
    const main = MAIN.map(k => u.cells[k]).filter(v => v !== undefined);
    u.done = main.length;
    u.avg = main.length ? main.reduce((a, b) => a + b, 0) / main.length : null;
    u.best = main.length ? Math.min(...main) : null;
    u.extra = Object.keys(u.cells).map(Number).filter(k => k >= 4).sort((a, b) => a - b).map(k => u.cells[k]);
  }
  return by;
}

export const fmtMs = v => (v === null || v === undefined ? '–' : `${Math.round(v)}`);
