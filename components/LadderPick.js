'use client';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { toast } from '@/lib/ui';

// 🪜 LIVE 사다리 번호 고르기 (라운드 PREPARING 동안). 사다리 모양은 마감 뒤 seed가 정해져야 생기므로 여기선 가림
// 참가자: 빈 번호 탭 = 선택/이동, 내 번호 다시 탭 = 취소. 관전자는 보기만
export default function LadderPick({ round, meId }) {
  const l = round.live;
  const n = round.players.length;
  const me = round.players.findIndex(p => p.id === meId);
  const srv = l.picks || {};
  const key = JSON.stringify(srv);
  const [opt, setOpt] = useState(undefined); // 낙관적 반영: 내 번호 (null = 취소). undefined = 서버 값 그대로
  const busy = useRef(false);
  useEffect(() => setOpt(undefined), [key]); // Realtime으로 서버 상태가 오면 그걸로

  if (l.phase !== 'PICK') {
    const c = l.cols?.[me];
    return (
      <div className="live-wait">
        <p className="live-badge">🔴 LIVE</p>
        <h3>🪜 사다리 준비 중…</h3>
        {Number.isInteger(c) && <p className="lane-mine">내 번호 <b>{c + 1}</b>번</p>}
        <p className="hint">잠시 후 모든 화면에서 동시에 시작합니다</p>
      </div>
    );
  }

  const picks = { ...srv };
  if (opt !== undefined) { delete picks[meId]; if (opt !== null) picks[meId] = opt; }
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const holder = {}; // 번호 → 참가자 id (내 낙관적 선택이 마지막에 덮음)
  Object.entries(picks).forEach(([id, c]) => { if (id !== meId) holder[c] = id; });
  if (picks[meId] !== undefined) holder[picks[meId]] = meId;
  const mine = me >= 0 ? picks[meId] : undefined;
  const left = round.players.filter(p => picks[p.id] === undefined);

  const tap = async c => {
    if (me < 0 || busy.current) return;
    if (holder[c] && holder[c] !== meId) return toast(`${name[holder[c]]}님이 고른 번호입니다`);
    const next = mine === c ? null : c;
    busy.current = true;
    setOpt(next);
    try {
      await rpc('ladder_pick', { p_token: getSession()?.token, p_round: round.id, p_lane: next });
    } catch (e) {
      setOpt(undefined);
      toast(e.message);
    }
    busy.current = false;
  };

  return (
    <div className="stack">
      <p className="live-title"><span className="live-badge">🔴 LIVE</span> 🪜 사다리 번호 고르기</p>
      <div className="lane-head">
        <p className="lane-count"><b>{n - left.length}</b> / {n}명 선택</p>
        <p className="hint">
          {me < 0 ? '참가자들이 번호를 고르는 중입니다' : mine === undefined ? '출발할 번호를 눌러 고르세요' : <>내 번호 <b>{mine + 1}</b>번 · 다시 누르면 취소</>}
        </p>
      </div>
      <div className="lane-grid">
        {[...Array(n).keys()].map(c => {
          const h = holder[c];
          return (
            <button key={c} className={`lane-btn${h === meId ? ' mine' : h ? ' taken' : ''}`}
              disabled={me < 0} aria-pressed={h === meId} onClick={() => tap(c)}>
              <b>{c + 1}</b><small>{h ? name[h] : '비어 있음'}</small>
            </button>
          );
        })}
      </div>
      <div className="lane-cover" aria-hidden><b>?</b><span>사다리는 마감 후 공개</span></div>
      <p className="notice">관리자가 마감하면 남은 번호는 무작위로 배정돼요</p>
      {left.length > 0 && <p className="hint">아직 안 고른 사람: {left.map(p => p.name).join(', ')}</p>}
    </div>
  );
}
