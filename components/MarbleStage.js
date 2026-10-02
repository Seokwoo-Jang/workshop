'use client';
import { useEffect, useRef, useState } from 'react';
import { createView } from '@/lib/marble/render';
import { useWakeLock } from '@/lib/ui';

// 🎱 구슬 레이스 재생. clock() - startAt 만큼 진행된 장면을 그린다 → 중간 접속/복귀해도 같은 지점부터.
// onEnd: 재생이 끝나면 1회 호출 (결과는 그 전까지 화면에 내지 않는다)
export default function MarbleStage({ meta, track, names, startAt, clock, onEnd, watermark, final = 0 }) {
  const ref = useRef(null);
  const [st, setSt] = useState({ phase: 'count', sec: 0, arrived: 0 });
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useWakeLock(st.phase !== 'end');

  useEffect(() => {
    const view = createView(ref.current, { meta, track, names });
    let raf = 0;
    const loop = () => {
      const ms = clock() - startAt;
      const arrived = view.draw(Math.min(ms, meta.durationMs));
      const phase = ms < 0 ? 'count' : ms < meta.durationMs ? 'play' : 'end';
      const sec = ms < 0 ? Math.ceil(-ms / 1000) : 0;
      setSt(s => (s.phase === phase && s.sec === sec && s.arrived === arrived ? s : { phase, sec, arrived }));
      if (phase === 'end') endRef.current?.();
      else raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [meta, track, names, startAt, clock]);

  const seats = final > 0 ? Math.max(0, meta.n - final - st.arrived) : null; // 자유 선택 남은 자리
  const order = meta.goals.slice(0, st.arrived).map((g, i) => [i + 1, names[g[0]]]).slice(-6); // 최근 도착 6명

  return (
    <div className="stage">
      <canvas ref={ref} className="stage-cv" aria-label="구슬 레이스 화면" />
      {st.phase === 'count' && (
        <div className="stage-over">{st.sec <= 3 ? <b className="count">{st.sec}</b> : <span>곧 시작합니다</span>}</div>
      )}
      {watermark && <div className="watermark">{watermark}</div>}
      <div className="stage-side" aria-live="polite">
        {seats !== null && <p className="left">FINAL까지 남은 자리 <b>{seats}</b></p>}
        <ol>{order.map(([rank, nm]) => <li key={rank}><span>{rank}</span>{nm}</li>)}</ol>
      </div>
    </div>
  );
}
