// 🎮 게임 목록 + 라운드 준비/종료 판정 (LIVE·연습 공용)
import { simulate } from './marble/engine';
import { wheelPlan } from './wheel/plan';
import { ladderPlan } from './ladder/plan';
import { REVEAL_GAP } from './reaction/core';

export const GAMES = [
  { key: 'marble', label: '🎱 구슬 레이스', use: '2단계 순서 결정 (메인)' },
  { key: 'reaction', label: '⚡ 반응속도', use: 'FINAL 3명 (메인)' },
  { key: 'wheel', label: '🎡 돌림판', use: '꼴찌 동점 · 즉석 추첨 (1명 당첨)' },
  { key: 'ladder', label: '🪜 사다리타기', use: '사격 순서 · 2단계 백업' },
];
export const gameLabel = k => GAMES.find(g => g.key === k)?.label || k;

// 관리자 기기(LIVE) 또는 내 폰(연습)에서 seed로 결과 계산 → { meta, data }. 같은 seed면 항상 같은 결과
export async function prepareRound(game, names, seed, opts = {}, onProgress) {
  const n = names.length;
  if (game === 'wheel') return { meta: wheelPlan(n, seed, opts), data: '' };
  if (game === 'ladder') return { meta: ladderPlan(n, seed, opts), data: '' };
  return simulate(names, seed, { map: opts.map || 0, cut: opts.final ? n - opts.final : undefined, onProgress, signal: opts.signal });
}

// 재생(또는 결과 공개)이 끝났는지 — 끝나기 전에는 결과를 화면에 내지 않는다
export function roundEnded(round, now) {
  if (!round || round.state !== 'PLAYING') return false;
  if (round.game_type === 'reaction') {
    const l = round.live;
    return l?.phase === 'REVEAL' && !!l.reveal_at && now >= new Date(l.reveal_at).getTime() + REVEAL_GAP * 2 + 1000;
  }
  return !!round.meta && now >= new Date(round.start_at).getTime() + round.meta.durationMs;
}
