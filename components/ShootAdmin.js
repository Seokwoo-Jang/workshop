'use client';
import { useState } from 'react';
import { rpc } from '@/lib/supabase';
import { picksOf } from '@/lib/prizes';
import { shootBoard } from '@/lib/shoot';

// 🎯 관리자: 점수 입력/수정, 공동 1·2·3위 재사격(2차전) 맞힌 수 입력, 1위 선택 상품. 게임과 연동 없음
export default function ShootAdmin({ A, room, people, scores, run }) {
  const [draft, setDraft] = useState({}); // user_id → {score, tiebreak} (문자열)
  const { ties } = shootBoard(people, scores);
  const cur = Object.fromEntries(scores.map(s => [s.user_id, s]));
  const str = v => (v === null || v === undefined ? '' : String(v));
  const saved = id => ({ score: str(cur[id]?.score), tiebreak: str(cur[id]?.tiebreak) });

  // 2차전 빈칸 = 2차전 안 함. 점수를 바꾸면 2차전은 비움 (다른 점수대의 2차전 값이 따라오지 않게)
  const val = (id, k) => draft[id]?.[k] ?? saved(id)[k];
  const edit = (id, k) => e => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 3);
    setDraft(d => ({ ...d, [id]: { ...saved(id), ...d[id], [k]: v, ...(k === 'score' && v !== saved(id).score ? { tiebreak: '' } : {}) } }));
  };
  const dirty = id => draft[id] && (draft[id].score !== saved(id).score || draft[id].tiebreak !== saved(id).tiebreak);

  const save = id => run(async () => {
    const d = draft[id];
    await rpc('admin_set_score', { p_admin: A, p_user: id, p_score: d.score === '' ? null : +d.score, p_tiebreak: d.tiebreak === '' ? null : +d.tiebreak });
    setDraft(x => { const y = { ...x }; delete y[id]; return y; });
  }, null, ['scores']);

  const setPick = pick => run(() => rpc('admin_set_shoot', { p_admin: A, p_pick: pick || null }), '저장했습니다', ['room']);

  return (
    <section className="panel">
      <h3>🎯 사격 점수</h3>
      <p className="hint">점수를 비우고 저장하면 기록이 삭제됩니다. 공동 1·2·3위는 재사격 후 맞힌 수를 '2차전' 칸에 입력하세요 (빈칸 = 2차전 안 함).</p>
      {ties.map(t => <p key={t.rank} className="notice">🔁 공동 {t.rank}위: {t.names.join(', ')} — 재사격(2차전)</p>)}
      <ul className="admin-list">
        <li className="hint"><span className="grow" /> <span className="score-h">점수</span><span className="score-h">2차전</span><span style={{ width: 52 }} /></li>
        {people.map(p => (
          <li key={p.id}>
            <span className="grow">{p.name}</span>
            <input className="input score-in" inputMode="numeric" placeholder="점수" aria-label={`${p.name} 점수`}
              value={val(p.id, 'score')} onChange={edit(p.id, 'score')} />
            <input className="input score-in" inputMode="numeric" placeholder="2차전" aria-label={`${p.name} 재사격(2차전)`}
              value={val(p.id, 'tiebreak')} onChange={edit(p.id, 'tiebreak')} />
            <button className="btn primary small" disabled={!dirty(p.id)} onClick={() => save(p.id)}>저장</button>
          </li>
        ))}
      </ul>

      <div className="field">
        <label htmlFor="spick">🥇 사격 1위가 고른 상품 (남은 것이 FINAL 1위 상품으로 표시)</label>
        <select id="spick" className="input" value={room.shoot_pick || ''} onChange={e => setPick(e.target.value)}>
          <option value="">미정</option>
          {picksOf(room).map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
    </section>
  );
}
