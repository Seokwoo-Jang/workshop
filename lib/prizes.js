// 🎁 경품 / 시상 룰 (스펙 6장). 이름은 관리자가 수정 (rooms.prizes). 자유 선택 상품은 현장 진열, 앱 미표시
export const DEFAULT_PRIZES = {
  pick1: '가민', pick2: '애플워치', // 사격 1위가 둘 중 하나 선택 → 남은 것이 FINAL 1위 상품
  shoot2: '에어팟',
  shoot3: '마샬 윌렌',
  last: '당첨 시 공개', // 💩 꼴찌: 공개 로직 없음, 현장에서 실물 전달
  final2: '글렌피딕 15년',
  final3: '??? 상품권 (10만원 상당)', // 시상 때 실제 이름으로 바꾸면 모든 화면에 반영
};

// 기본값 위에 덮어씀 (마이그레이션 전·방 로딩 중에도 동작)
export const prizesOf = room => ({ ...DEFAULT_PRIZES, ...room?.prizes });
export const picksOf = room => { const p = prizesOf(room); return [p.pick1, p.pick2]; };

export const shootPrizes = room => {
  const p = prizesOf(room);
  return [
    ['🥇', '1위', `${p.pick1} / ${p.pick2} 중 택1`],
    ['🥈', '2위', p.shoot2],
    ['🥉', '3위', p.shoot3],
  ];
};
export const shootLast = room => prizesOf(room).last;

// FINAL 1위 상품: 사격 1위 선택이 입력되면 남은 것으로 표시
export const finalPrizes = room => {
  const p = prizesOf(room);
  const picks = [p.pick1, p.pick2];
  const pick = room?.shoot_pick;
  return [
    ['🥇', 'FINAL 1위', picks.includes(pick) ? picks.find(x => x !== pick) : `${p.pick1} / ${p.pick2} 중 사격 1위가 고르고 남은 것`],
    ['🥈', 'FINAL 2위', p.final2],
    ['🥉', 'FINAL 3위', p.final3],
  ];
};

export const RULES = [
  '사격 1·2·3위와 꼴찌(4명)는 추첨 대상에서 제외',
  '나머지 전원 🎱 구슬 레이스 1회',
  '1~16위: 순위대로 자유 선택 상품 고르기',
  '17~19위: ⚡ FINAL 진출 → 반응속도로 특별상품 1·2·3위 결정',
];
