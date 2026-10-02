// 🪜 사다리타기: seed → 가로줄 구조 → 결정론적 결과. 모든 폰이 같은 구조를 시각만큼 따라 내려가는 연출
// 사다리 생성·경로는 zeikar/whozzie (MIT, lib/ladder/whozzie.js). 원본 dealRound와 같은 방식으로
// 참가자를 출발 칸에 무작위 배치 → 사다리 모양과 무관하게 누구나 각 순위 확률 1/n (원본은 crypto 난수, 여기선 서버 seed)
import { rng } from '../rng';
import { generateLadder, trace } from './whozzie';

export const LADDER_MS = 9000;

export function ladderPlan(n, seed, { final = 0 } = {}) {
  const rand = rng(seed);
  const r = { int: k => Math.floor(rand() * k), float: rand };
  const ladder = generateLadder(n, r);
  const cols = [...Array(n).keys()]; // cols[참가자] = 출발 칸
  for (let i = n - 1; i > 0; i--) { const j = r.int(i + 1); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const dest = cols.map(c => trace(ladder, c).end); // dest[참가자] = 도착 칸 (왼쪽부터 1위)
  return {
    v: 1, n, rows: ladder.rows, rungs: ladder.rungs, cols, dest, final, durationMs: LADDER_MS,
    ranking: [...Array(n).keys()].sort((a, b) => dest[a] - dest[b]),
  };
}

// 재생용: meta → whozzie ladder 객체
export const ladderOf = meta => ({ columns: meta.n, rows: meta.rows, rungs: meta.rungs });
