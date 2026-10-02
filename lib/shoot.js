// 🎯 사격 순위만 계산 (게임과 연동 없음). 점수 ↓ → 재사격(2차전) 맞힌 수 ↓
// 2차전은 둘 다 2차전을 한 경우에만 비교 (null = 2차전 안 함). 가를 수 없으면 공동 순위 (1, 1, 3 …)
// 🥇🥈🥉 = 1~3위, 💩 = 최저점 (동점이면 전원 표시만, 자동 처리 없음)
const MEDALS = ['🥇', '🥈', '🥉'];

export function shootBoard(people, scores) {
  const name = Object.fromEntries(people.map(p => [p.id, p.name]));
  const rows = scores
    .filter(s => name[s.user_id] !== undefined)
    .map(s => ({ ...s, tiebreak: s.tiebreak ?? null, name: name[s.user_id] }))
    .sort((a, b) => b.score - a.score || (b.tiebreak ?? -1) - (a.tiebreak ?? -1) || a.name.localeCompare(b.name, 'ko'));
  const better = (o, r) => o.score > r.score
    || (o.score === r.score && o.tiebreak !== null && r.tiebreak !== null && o.tiebreak > r.tiebreak);
  rows.forEach(r => { r.rank = 1 + rows.filter(o => better(o, r)).length; });
  rows.forEach(r => { r.tied = rows.some(o => o !== r && o.rank === r.rank); });

  // 수상자(1~3위)가 아닌 사람 중 최저점. 기록이 4명 이상일 때만
  const min = rows.length > 3 ? Math.min(...rows.map(r => r.score)) : null;
  rows.forEach(r => {
    r.medal = r.rank <= 3 ? MEDALS[r.rank - 1] : '';
    r.poop = min !== null && r.score === min && r.rank > 3;
  });

  // 공동 1·2·3위 → 재사격 대상 (관리자 안내용)
  const ties = [1, 2, 3].map(k => ({ rank: k, names: rows.filter(r => r.rank === k).map(r => r.name) })).filter(t => t.names.length > 1);
  const unscored = people.filter(p => !scores.some(s => s.user_id === p.id));
  return { rows, ties, unscored };
}
