// 시드 고정 난수 (mulberry32, lazygyu/roulette scripts/simulate.ts 와 같음). 같은 seed → 모든 폰에서 같은 결과
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => Math.floor(Math.random() * 2147483647); // 연습 모드용
