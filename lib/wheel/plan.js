// 🎡 돌림판: seed → 당첨자 + 최종 회전 각도. 모든 폰이 같은 easing으로 각도만 재생 (시각 → 각도, seek 가능)
import { rng } from '../rng';

export const WHEEL_MS = 7000;
const MIN_SEGS = 8; // 인원이 적으면 이름을 반복 배치 (2명 → 8칸). 각자 칸 수가 같으므로 확률 동일

export function wheelPlan(n, seed) {
  const rand = rng(seed);
  const reps = Math.max(1, Math.ceil(MIN_SEGS / n));
  const segs = [];
  for (let r = 0; r < reps; r++) for (let i = 0; i < n; i++) segs.push(i);

  const winner = Math.floor(rand() * n);
  const mine = segs.map((p, k) => (p === winner ? k : -1)).filter(k => k >= 0);
  const seg = mine[Math.floor(rand() * mine.length)];
  const segDeg = 360 / segs.length;
  // 포인터는 12시. 칸 k(시계방향)의 중심을 포인터로: 회전 ≡ 360 - (k + 0.5)·segDeg. 칸 안에서 ±35% 흔들림
  const jitter = (rand() - 0.5) * 0.7 * segDeg;
  const turns = 5 + Math.floor(rand() * 3);
  const end = turns * 360 + (360 - (seg + 0.5) * segDeg) + jitter;

  return {
    v: 1, n, segs, winner, seg, end, durationMs: WHEEL_MS,
    ranking: [winner, ...[...Array(n).keys()].filter(i => i !== winner)],
  };
}

const easeOut = t => 1 - (1 - t) ** 4;

// 시각 ms(재생 시작 기준)의 회전 각도(도, 시계방향)
export const wheelAngleAt = (meta, ms) => meta.end * easeOut(Math.min(1, Math.max(0, ms / meta.durationMs)));

// 회전 각도에서 포인터(12시)가 가리키는 칸
export const segAt = (meta, deg) => {
  const segDeg = 360 / meta.segs.length;
  return Math.floor((((360 - (deg % 360)) % 360) / segDeg)) % meta.segs.length;
};
