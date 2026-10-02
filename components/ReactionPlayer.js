'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { boardOf, fmtMs, trialLabel } from '@/lib/reaction/core';
import { useWakeLock } from '@/lib/ui';
import ReactionPad from './ReactionPad';
import { useTrials } from './ReactionLive';

const PENDING = 'ws.rx.pending'; // 전송 못 한 기록 (재전송, 서버는 trial_id로 중복 무시)
const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING)); } catch { return null; } };

// ⚡ FINAL 플레이어 본인 폰: 풀스크린 (관리자 패널 위에도 뜸). [준비 완료] → 빨강 → 초록 → 탭
// 부정출발 / 대기 중 앱 이탈 → 그 판 무효, 같은 판 다시. 기록은 서버가 받을 때까지 계속 재전송
export default function ReactionPlayer({ round, sess }) {
  const l = round.live;
  const [trial, setTrial] = useState(null);   // {key: trial_id, delay_ms, trial_no}
  const [flash, setFlash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(() => (readPending()?.round === round.id ? readPending() : null));
  const cur = useRef(null);
  const done = useRef(new Set());              // 이미 친 trial_id → 다시 시작하지 않음
  const sending = useRef(false);
  cur.current = trial;
  if (pending) done.current.add(pending.trial);
  useWakeLock(true);

  // 대기 중인 기록 전송. 받아지거나 더 이상 의미 없으면(STALE/차례 지남) 정리
  const flush = useCallback(async () => {
    const rec = readPending();
    if (!rec || rec.round !== round.id || sending.current) return;
    sending.current = true;
    try {
      const r = await rpc('reaction_submit', { p_token: sess.token, p_round: rec.round, p_trial: rec.trial, p_ms: rec.ms, p_false: rec.falseStart });
      if (r?.status === 'false_start' && !rec.falseStart) setFlash('부정출발 판정 — 같은 판 다시');
      localStorage.removeItem(PENDING); setPending(null);
    } catch (e) {
      if (['STALE_TRIAL', 'NOT_YOUR_TURN', 'ROUND_GONE'].includes(e.code)) { localStorage.removeItem(PENDING); setPending(null); }
    }
    sending.current = false;
  }, [round.id, sess.token]);

  // 재전송: 처음, 상태 변화, 네트워크 복구, 화면 복귀, 4초마다
  useEffect(() => { flush(); }, [flush, l.seq]);
  useEffect(() => {
    const on = () => document.visibilityState !== 'hidden' && flush();
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', on);
    const id = setInterval(flush, 4000);
    return () => { window.removeEventListener('online', on); document.removeEventListener('visibilitychange', on); clearInterval(id); };
  }, [flush]);

  const start = t => {
    if (!t?.key || done.current.has(t.key) || cur.current?.key === t.key) return;
    setFlash(null);
    setTrial(t);
  };

  // 서버 상태 따라가기: 관리자가 대신 시작(WAIT) → 그 판 시작 / 관리자가 진행 중인 판을 무효(READY) → 중단
  useEffect(() => {
    if (l.step === 'WAIT' && l.trial_id) start({ key: l.trial_id, delay_ms: l.delay_ms, trial_no: l.trial_no });
    else if (l.step === 'READY' && cur.current && l.prev?.voided && l.prev.trial_no === cur.current.trial_no) {
      done.current.add(cur.current.key);
      setFlash('관리자가 무효 처리 — 다시');
      setTrial(null);
    }
  }, [l.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // 대기/초록 중 앱 이탈 → 무효
  useEffect(() => {
    const on = () => {
      const t = cur.current;
      if (document.visibilityState === 'hidden' && t) {
        done.current.add(t.key);
        rpc('reaction_void', { p_token: sess.token, p_round: round.id, p_trial: t.key, p_reason: 'leave' }).catch(() => {});
        setTrial(null);
        setFlash('화면을 벗어나 무효 — 다시');
      }
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [round.id, sess.token]);

  const ready = async () => {
    setBusy(true); setFlash(null);
    try {
      const r = await rpc('reaction_ready', { p_token: sess.token, p_round: round.id });
      start({ key: r.trial_id, delay_ms: r.delay_ms, trial_no: r.trial_no });
    } catch (e) { setFlash(e.message); }
    setBusy(false);
  };

  const onGo = () => {
    const t = cur.current;
    if (t) rpc('reaction_go', { p_token: sess.token, p_round: round.id, p_trial: t.key }).catch(() => {});
  };

  const onResult = ({ ms, falseStart }) => {
    const t = cur.current;
    if (!t) return;
    done.current.add(t.key);
    setFlash(falseStart ? '너무 빨라요! 무효 — 다시' : `${ms} ms`);
    setTrial(null);
    const rec = { round: round.id, trial: t.key, ms, falseStart };
    localStorage.setItem(PENDING, JSON.stringify(rec));
    setPending(rec);
    flush();
  };

  // 기록판: 내 기록 + 마지막 차례면 목표(1위 평균)
  const board = boardOf(useTrials(round));
  const mine = board[sess.participant_id];
  const others = Object.entries(board).filter(([u, b]) => u !== sess.participant_id && b.done === 3).map(([, b]) => b.avg);
  const isLast = l.extra_round === undefined && !l.queue.slice(l.turn + 1).some(id => !(l.skipped || []).includes(id));
  const target = isLast && others.length ? Math.min(...others) : null;

  const no = trial?.trial_no ?? l.trial_no;
  return (
    <div className="rx-full" role="dialog" aria-modal="true" aria-label="반응속도 플레이">
      <div className="rx-head">
        <p className="live-badge">🔴 LIVE · ⚡ FINAL</p>
        <h3>내 차례 · {trialLabel(no)}</h3>
        <p className="hint">원이 <b style={{ color: '#16a34a' }}>초록색</b>으로 바뀌면 바로 누르세요. 먼저 누르면 무효 후 다시.</p>
        <p className="rx-mine">
          {[1, 2, 3].map(k => <span key={k}>{k}판 <b>{fmtMs(mine?.cells[k])}</b></span>)}
          {target !== null && <span className="rx-goal">🎯 1위 평균 {fmtMs(target)} ms</span>}
        </p>
      </div>
      <ReactionPad trial={trial} onGo={onGo} onResult={onResult} flash={flash}
        idle={{ title: '준비되면', sub: pending ? '기록 전송 중…' : '아래 버튼을 누르세요',
          button: pending ? '전송 중…' : busy ? '…' : '준비 완료', onButton: ready, disabled: busy || !!pending }} />
    </div>
  );
}
