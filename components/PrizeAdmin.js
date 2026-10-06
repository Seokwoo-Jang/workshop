'use client';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { finalPrizes, picksOf, prizesOf } from '@/lib/prizes';

const FIELDS = [
  ['pick1', '🥇 사격 1위 선택지 A'],
  ['pick2', '🥇 사격 1위 선택지 B'],
  ['shoot2', '🥈 사격 2위'],
  ['shoot3', '🥉 사격 3위'],
  ['last', '💩 꼴찌 문구'],
  ['final2', '🥈 FINAL 2위'],
  ['final3', '🥉 FINAL 3위'],
];
const same = (a, b) => FIELDS.every(([k]) => a[k] === b[k]);

// 🎁 관리자: 경품 이름 수정 (당일 변동 대비). 저장하면 모든 화면에 실시간 반영
export default function PrizeAdmin({ A, room, run }) {
  const saved = prizesOf(room);
  const [base, setBase] = useState(saved); // 폼을 채운 시점의 저장값
  const [f, setF] = useState(saved);
  const key = JSON.stringify(saved);
  // 다른 곳에서 바뀌면 다시 채움 (수정 중이면 유지)
  useEffect(() => {
    setF(cur => (same(cur, base) ? saved : cur));
    setBase(saved);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = !same(f, saved);

  // FINAL 1위 미리보기: 이미 고른 1위 상품은 같은 자리(A/B)의 새 이름으로
  const i = picksOf(room).indexOf(room.shoot_pick);
  const final1 = finalPrizes({ prizes: f, shoot_pick: i < 0 ? null : [f.pick1, f.pick2][i] })[0][2];

  const save = () => run(async () => {
    const p = Object.fromEntries(FIELDS.map(([k]) => [k, f[k].trim()]));
    await rpc('admin_set_prizes', { p_admin: A, p_prizes: p });
    setF(p);
  }, '경품 이름을 저장했습니다', ['room']);

  return (
    <section className="panel">
      <h3>🎁 경품 이름</h3>
      <p className="hint">FINAL 3위는 '??? …'로 두었다가 시상 때 실제 이름으로 바꾸면 모든 화면에 바로 반영됩니다.</p>
      {FIELDS.map(([k, label]) => (
        <div className="field" key={k}>
          <label htmlFor={`prize-${k}`}>{label}</label>
          <input id={`prize-${k}`} className="input" maxLength={40} value={f[k]}
            onChange={e => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      <p className="hint">🥇 FINAL 1위 (자동): <b>{final1}</b></p>
      <div className="row">
        {dirty && <button className="btn ghost" onClick={() => setF(saved)}>되돌리기</button>}
        <button className="btn primary" disabled={!dirty} onClick={save}>경품 이름 저장</button>
      </div>
    </section>
  );
}
