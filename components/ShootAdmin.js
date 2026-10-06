'use client';
import { useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { ROOM } from '@/lib/session';
import { picksOf } from '@/lib/prizes';
import { inShootOrder, shootBoard } from '@/lib/shoot';

// 🎯 관리자: 점수 입력/수정, 공동 1·2·3위 재사격(2차전) 맞힌 수 입력, 1위 선택 상품. 순위는 게임과 연동 없음
// 입력 목록은 🪜 사격 순서 사다리(FINAL 0) 최근 결과 순서대로 (없으면 입장 순)
export default function ShootAdmin({ A, room, people, scores, run, live }) {
  const [draft, setDraft] = useState({}); // user_id → {score, tiebreak} (문자열)
  const [order, setOrder] = useState(null); // 사격 순서 (참가자 id 배열)
  const roundKey = `${live?.round?.id}:${live?.round?.state}`; // 새 라운드가 끝나면 다시 확인
  useEffect(() => {
    let alive = true;
    sb.from('game_rounds').select('result,opts').eq('room_code', ROOM).eq('game_type', 'ladder').eq('state', 'PLAYING')
      .order('created_at', { ascending: false }).limit(10)
      .then(r => { if (alive && !r.error) setOrder(r.data.find(g => !g.opts?.final && !g.opts?.prizes && Array.isArray(g.result))?.result ?? null); });
    return () => { alive = false; };
  }, [roundKey]);
  const { ties } = shootBoard(people, scores);
  const cur = Object.fromEntries(scores.map(s => [s.user_id, s]));
  const list = inShootOrder(people, order);
  const next = order ? list.find(p => p.no && !cur[p.id]) : null; // 순서상 아직 점수 없는 첫 사람
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
      <p className="hint">
        {order ? '🪜 사다리로 정한 사격 순서대로 · 사다리 뒤에 들어온 사람은 맨 아래'
          : '🎮 LIVE에서 🪜 사다리를 [🎯 사격 순서]로 하면 그 순서대로 정렬됩니다 (지금은 입장 순)'}
      </p>
      <ul className="admin-list">
        <li className="hint">{order && <span className="shoot-no" />}<span className="grow" /> <span className="score-h">점수</span><span className="score-h">2차전</span><span style={{ width: 52 }} /></li>
        {list.map(p => (
          <li key={p.id} className={next?.id === p.id ? 'next' : ''}>
            {order && <span className="shoot-no">{p.no ?? '–'}</span>}
            <span className="grow">{p.name}{next?.id === p.id && <> <b className="badge sea">다음</b></>}</span>
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
