'use client';
import { useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { finalPrizes } from '@/lib/prizes';
import { MAIN, REVEAL_GAP, boardOf, fmtMs, trialLabel } from '@/lib/reaction/core';
import { useNow } from '@/lib/time';

// 라운드 판 기록 (live.seq가 바뀔 때마다 다시 읽음)
export function useTrials(round) {
  const [trials, setTrials] = useState([]);
  const seq = round.live?.seq;
  useEffect(() => {
    let ok = true;
    sb.from('reaction_trials').select('user_id,trial_no,reaction_ms,false_start,voided,created_at')
      .eq('round_id', round.id).order('created_at')
      .then(r => ok && !r.error && setTrials(r.data));
    return () => { ok = false; };
  }, [round.id, seq]);
  return trials;
}

// ⚡ 관전 화면 (+ 결과 공개). START 즉시 첫 플레이어부터 본게임 3판. 현재 플레이어 본인은 page.js의 ReactionPlayer 풀스크린
export default function ReactionLive({ round, meId, room }) {
  const l = round.live;
  const trials = useTrials(round);
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const board = boardOf(trials);

  if (l.phase === 'REVEAL') return <ReactionResult round={round} room={room} meId={meId} />;

  // TURN
  const curId = l.queue[l.turn];
  const nextId = l.queue.slice(l.turn + 1).find(id => !(l.skipped || []).includes(id));
  const lastOfMine = l.prev && l.prev.user === curId && l.prev.trial_no === l.trial_no ? l.prev : null; // 방금 무효된 같은 판
  const prev = l.prev && l.step === 'READY' ? l.prev : null;
  const isLast = !nextId && l.extra_round === undefined;
  const others = Object.entries(board).filter(([u]) => u !== curId && board[u].done === 3).map(([, b]) => b.avg);
  const target = isLast && others.length ? Math.min(...others) : null;

  let circle;
  if (l.step === 'WAIT') circle = <div className="rx-mini wait"><b>기다리는 중…</b></div>;
  else if (l.step === 'GO') circle = <div className="rx-mini go"><b>초록!</b></div>;
  else if (prev) circle = (
    <div className={`rx-mini ${prev.voided || prev.false_start ? 'bad' : 'done'}`}>
      <b>{prev.false_start ? '부정출발' : prev.voided ? '무효' : `${prev.ms} ms`}</b>
      <small>{name[prev.user]} · {trialLabel(prev.trial_no)}{(prev.false_start || prev.voided) ? ' → 다시' : ''}</small>
    </div>
  );
  else circle = <div className="rx-mini"><b>준비 중</b></div>;

  return (
    <div className="stack">
      <p className="live-title"><span className="live-badge">🔴 LIVE</span> ⚡ FINAL 반응속도</p>
      {nextId === meId && <p className="notice">⏭ 다음 차례입니다! 준비하세요</p>}
      <section className="panel rx-now">
        <p className="rx-np">NOW PLAYING</p>
        <h3>{name[curId]}{curId === meId && ' (나)'}</h3>
        <p className="hint">{trialLabel(l.trial_no)}{lastOfMine && (lastOfMine.false_start || lastOfMine.voided) ? ' · 다시' : ''}</p>
        {circle}
        {target !== null && <p className="rx-target">🎯 1위 평균 {fmtMs(target)} ms 보다 빠르면 1위</p>}
      </section>
      <Board round={round} board={board} name={name} meId={meId} cur={curId} />
    </div>
  );
}

function Board({ round, board, name, meId, cur }) {
  const l = round.live;
  const extraN = l.extra_round || 0;
  return (
    <section className="panel">
      <h3>기록판 (ms) · 본게임 3판 평균이 빠른 순</h3>
      <table className="rx-board">
        <thead>
          <tr><th>순서</th>{MAIN.map(k => <th key={k}>{k}판</th>)}
            {[...Array(extraN)].map((_, i) => <th key={`x${i}`}>+{i + 1}</th>)}<th>평균</th></tr>
        </thead>
        <tbody>
          {l.order.map((id, i) => {
            const b = board[id];
            return (
              <tr key={id} className={`${id === cur ? 'cur' : ''} ${id === meId ? 'me' : ''}`}>
                <td className="nm">{i + 1}. {name[id]}{(l.skipped || []).includes(id) && ' (스킵)'}</td>
                {MAIN.map(k => <td key={k}>{fmtMs(b?.cells[k])}</td>)}
                {[...Array(extraN)].map((_, i) => <td key={`x${i}`}>{fmtMs(b?.cells[4 + i])}</td>)}
                <td className="avg">{b?.done === 3 ? fmtMs(b.avg) : '–'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// 결과 공개: 3위 → 2위 → 1위 (REVEAL_GAP 간격), 1위는 상품 함께
export function ReactionResult({ round, room, meId }) {
  const board = boardOf(useTrials(round));
  const at = round.live?.reveal_at ? new Date(round.live.reveal_at).getTime() : 0;
  return (
    <div className="stack">
      <p className="live-title">⚡ FINAL 결과</p>
      <Podium round={round} room={room} meId={meId} at={at}
        sub={id => (board[id]?.avg != null ? `평균 ${fmtMs(board[id].avg)} ms` : null)} />
    </div>
  );
}

// 🏆 FINAL 시상 공개 (반응속도, 백업 구슬 레이스·사다리 공용): at부터 3위 → 2위 → 1위, 특별상품 함께
export function Podium({ round, room, meId, at, sub }) {
  const now = useNow(250);
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const ids = round.result || [];
  const prizes = finalPrizes(room);
  const top = ids.slice(0, 3);
  const shown = k => now >= at + (top.length - 1 - k) * REVEAL_GAP; // k=0(1위)이 마지막
  return (
    <>
      <ol className="podium">
        {top.map((id, k) => (
          <li key={id} className={`${shown(k) ? 'on' : ''} ${id === meId ? 'me' : ''} r${k + 1}`}>
            {shown(k) ? (
              <>
                <span className="medal">{prizes[k][0]}</span>
                <span className="who"><b>{name[id]}</b>{sub?.(id) && <small> {sub(id)}</small>}</span>
                <span className="prize">{prizes[k][2]}</span>
              </>
            ) : <><span className="medal">❔</span><span className="who"><b>{k + 1}위 공개 대기…</b></span></>}
          </li>
        ))}
      </ol>
      {ids.length > 3 && shown(0) && <p className="hint">{ids.slice(3).map(id => name[id]).join(', ')}</p>}
    </>
  );
}

// 관리자: 순서 공개 → 시작 / 강제 시작 / 판 무효·재시도 / 스킵
export function ReactionAdmin({ A, round, ask, fail }) {
  const l = round.live;
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const cur = l.queue?.[l.turn];
  // 누른 순간 보던 상태(seq)를 함께 보냄 → 확인창 사이에 판이 끝났으면 서버가 CHANGED로 거부 (엉뚱한 기록 무효/스킵 방지)
  const act = async (action, msg) => {
    const seq = l.seq ?? 0;
    if (msg && !(await ask(msg, '확인', action !== 'force'))) return;
    try { await rpc('admin_reaction', { p_admin: A, p_round: round.id, p_action: action, p_seq: seq }); }
    catch (e) { fail(e); }
  };
  if (l.phase === 'REVEAL') {
    return (
      <div className="stack">
        <p className="hint">결과 공개 중 (3위 → 2위 → 1위)</p>
        <button className="btn ghost small" onClick={() => act('void', '마지막 유효 기록을 무효로 하고 그 판부터 다시 할까요?\n(공개가 취소됩니다)')}>↩️ 마지막 판 무효 · 재시도</button>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="turn">지금: <b>{name[cur]}</b> · {trialLabel(l.trial_no)} · {l.step === 'READY' ? '준비 대기' : l.step === 'WAIT' ? '빨강 대기' : '초록'}</p>
      <div className="row">
        <button className="btn ghost small" disabled={l.step !== 'READY'} onClick={() => act('force')}>⏩ 대신 시작</button>
        <button className="btn ghost small" onClick={() => act('void', l.step === 'READY'
          ? '직전 유효 기록을 무효로 하고 그 판부터 다시 할까요?' : '진행 중인 판을 무효로 할까요?')}>🚫 판 무효 · 재시도</button>
        <button className="btn ghost small" onClick={() => act('skip', `${name[cur]}의 남은 판을 건너뛸까요?\n(맨 뒤 순위가 됩니다)`)}>⏭ 스킵</button>
      </div>
      <p className="hint">대신 시작: 플레이어가 '준비 완료'를 못 누를 때. 기록은 플레이어 폰에서 측정됩니다.</p>
    </div>
  );
}
