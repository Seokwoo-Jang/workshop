// 🪜 사다리타기: seed → 가로줄 구조 → 결정론적 결과. 모든 폰이 같은 구조를 시각만큼 따라 내려가는 연출
// 사다리 생성·경로는 zeikar/whozzie (MIT, lib/ladder/whozzie.js). 원본 dealRound와 같은 방식으로
// 참가자를 출발 칸에 무작위 배치 → 사다리 모양과 무관하게 누구나 각 순위 확률 1/n (원본은 crypto 난수, 여기선 서버 seed)
// LIVE는 참가자가 출발 번호를 직접 고름(cols) → seed는 고르기 마감 뒤에 정해지므로 고를 때는 사다리 모양을 모름
// 가로줄이 적어 도착 칸이 출발 칸 근처에 몰림 → 고른 번호면 결과판(slot: 도착 칸 → 순위)을 seed로 섞어 1/n 유지
import { rng } from '../rng';
import { generateLadder, trace } from './whozzie';

export const LADDER_MS = 9000;

// cols: 참가자 순서대로 출발 칸 (0..n-1 순열). 없으면 seed로 무작위 배치 (예전 라운드와 같은 결과)
export function ladderPlan(n, seed, { final = 0, cols: pick } = {}) {
  const rand = rng(seed);
  const r = { int: k => Math.floor(rand() * k), float: rand };
  const ladder = generateLadder(n, r);
  let cols; // cols[참가자] = 출발 칸
  if (pick) {
    if (!Array.isArray(pick) || pick.length !== n || new Set(pick).size !== n || !pick.every(c => Number.isInteger(c) && c >= 0 && c < n)) {
      throw new Error('BAD_COLS');
    }
    cols = [...pick];
  } else {
    cols = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = r.int(i + 1); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  }
  const dest = cols.map(c => trace(ladder, c).end); // dest[참가자] = 도착 칸
  let slot = null; // slot[도착 칸] = 순위 (0 = 1위). 무작위 배치(v1)는 왼쪽부터 1위
  if (pick) {
    slot = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = r.int(i + 1); [slot[i], slot[j]] = [slot[j], slot[i]]; }
  }
  const rk = p => (slot ? slot[dest[p]] : dest[p]);
  return {
    v: slot ? 2 : 1, n, rows: ladder.rows, rungs: ladder.rungs, cols, dest, ...(slot && { slot }), final, durationMs: LADDER_MS,
    ranking: [...Array(n).keys()].sort((a, b) => rk(a) - rk(b)),
  };
}

// 연습용: 참가자 p만 출발 칸 lane에 고정, 나머지는 무작위
export function colsWith(n, p, lane, rand = Math.random) {
  const rest = [...Array(n).keys()].filter(c => c !== lane);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  rest.splice(p, 0, lane);
  return rest;
}

// 재생용: meta → whozzie ladder 객체
export const ladderOf = meta => ({ columns: meta.n, rows: meta.rows, rungs: meta.rungs });
