'use client';
import { useEffect, useRef, useState } from 'react';
import { MIN_MS } from '@/lib/reaction/core';

// ⚡ 반응속도 원 (arealme 방식: 가운데 원이 빨강 → 초록으로 바뀌면 탭). 플레이어 LIVE / 연습 공용
// 상태 흐름(대기 → ready 빨강 → go 초록, 일찍 누르면 tooearly 후 같은 판 다시)과 색상은
// SultanAni/reaction-time-game (10e1e7d) script.js·style.css, 가운데 원은 tarcisiozf/reaction-time (b3f32b1) .led 기준.
// 둘 다 MIT — 전문은 lib/reaction/LICENSE. 타이머·측정·서버 연동은 새로 작성.
// trial: {key, delay_ms} — 새 key가 오면 빨강으로 기다렸다가 delay_ms 뒤 초록
// 측정: 초록을 DOM에 바로 칠하고 그 프레임의 rAF timestamp → pointerdown event.timeStamp (같은 performance 시계)
// onGo(): 초록이 칠해진 직후 1회 / onResult({ms, falseStart}): 판 결과 1회 (초록 전 탭·100ms 미만 = 부정출발)
export default function ReactionPad({ trial, onGo, onResult, idle, flash, watermark }) {
  const box = useRef(null);
  const st = useRef({ phase: 'idle', key: null, goTs: null, timer: 0 });
  const cb = useRef({ onGo, onResult });
  cb.current = { onGo, onResult };
  const [phase, setPhase] = useState('idle');

  const restAt = useRef(0); // 결과가 뜬 시각: 탭한 손가락의 click이 새 버튼으로 이어지는 것(ghost click) 무시
  const paint = p => {
    st.current.phase = p;
    if (p === 'done' || p === 'early') restAt.current = performance.now();
    if (box.current) box.current.dataset.phase = p;
    setPhase(p);
  };

  useEffect(() => {
    if (!trial) { // 판 끝(결과 색 유지) 또는 중단(대기 중이었으면 초기 색으로)
      clearTimeout(st.current.timer);
      st.current.key = null;
      if (st.current.phase === 'wait' || st.current.phase === 'go') paint('idle');
      return;
    }
    if (st.current.key === trial.key) return;
    clearTimeout(st.current.timer);
    st.current = { phase: 'wait', key: trial.key, goTs: null, timer: 0 };
    paint('wait');
    const key = trial.key;
    st.current.timer = setTimeout(() => {
      paint('go');
      st.current.paintTs = performance.now(); // rAF가 늦으면(백그라운드·과부하) 이 시각을 기준으로
      // 늦게 도착한 이전 판의 rAF가 새 판의 기준 시각을 덮어쓰지 않게: 같은 판 + 아직 초록일 때만
      requestAnimationFrame(ts => {
        if (st.current.key !== key || st.current.phase !== 'go') return;
        st.current.goTs = ts;
        cb.current.onGo?.();
      });
    }, trial.delay_ms);
  }, [trial?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(st.current.timer), []);

  const down = e => {
    const s = st.current;
    if (s.phase === 'wait') {
      clearTimeout(s.timer);
      paint('early'); // tooearly (주황)
      cb.current.onResult?.({ ms: null, falseStart: true });
    } else if (s.phase === 'go') {
      const t = e.timeStamp > 1e12 ? performance.now() : e.timeStamp; // 구형 브라우저: epoch ms
      const ms = Math.round(t - (s.goTs ?? s.paintTs));               // 초록 프레임 시각 (없으면 칠한 시각)
      paint(ms < MIN_MS ? 'early' : 'done');
      cb.current.onResult?.({ ms, falseStart: ms < MIN_MS });
    }
  };

  const rest = phase === 'idle' || phase === 'done' || phase === 'early';
  return (
    <div className="rx" ref={box} data-phase={phase} onPointerDown={down} onContextMenu={e => e.preventDefault()}>
      <div className="rx-circle" aria-live="assertive">
        {phase === 'wait' && <><b>기다리세요…</b><small>초록색이 되면 누르세요</small></>}
        {phase === 'go' && <b>지금!</b>}
        {rest && (flash ? <b className="rx-flash">{flash}</b> : <b>{idle?.title || '⚡'}</b>)}
        {rest && idle?.sub && <small>{idle.sub}</small>}
      </div>
      {idle?.button && ( // 자리는 항상 차지 (나타날 때 원이 밀리며 탭이 버튼에 닿지 않게)
        <button className="btn sun rx-btn" style={rest ? undefined : { visibility: 'hidden' }} disabled={!rest || idle.disabled}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => performance.now() - restAt.current > 500 && idle.onButton()}>
          {idle.button}
        </button>
      )}
      {watermark && <div className="watermark dark">{watermark}</div>}
    </div>
  );
}
