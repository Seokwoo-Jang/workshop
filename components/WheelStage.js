'use client';
import { useEffect, useRef, useState } from 'react';
import { Wheel } from '@/lib/spin-wheel/wheel.js';
import { wheelAngleAt } from '@/lib/wheel/plan';
import { useWakeLock } from '@/lib/ui';

// 🎡 돌림판 재생. 그리기는 spin-wheel(CrazyTim, MIT), 각도는 plan.js: 매 프레임 rotation = wheelAngleAt(clock() - startAt)
// spin()/spinTo()는 내부 타이머라 중간 접속 시 seek 불가 → 쓰지 않는다. 늦게 들어와도 같은 각도부터
// 각도계가 plan.js와 같음 (0 = 12시, 시계방향, 칸 k = [rotation + k·segDeg, +segDeg)) → 오프셋 0으로 12시 포인터가 meta.seg에 멈춤

const FONT = "'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif";
// [배경, 글자]. 사람마다 고정색 (2명 → 8칸이어도 같은 사람은 같은 색), 순서상 이웃끼리 다른 색
const PAL = [['#1a3a86', '#fff'], ['#f5a524', '#15181f'], ['#bd263d', '#fff'], ['#3f63b8', '#fff'], ['#fde9c4', '#15181f'], ['#e8798b', '#15181f']];
// n ≡ 1 (mod 색 수)면 마지막 사람과 0번이 같은 색으로 맞닿음 → 마지막 사람만 2번 색
const colorOf = (i, n, k) => (n > 1 && n % k === 1 && i === n - 1 ? 2 : i % k);
// 재생 시각 ms → 화면 단계 (첫 렌더부터 맞춰야 끝난 뒤 접속 시 카운트다운이 번쩍이지 않음)
const stateAt = (ms, dur) => ({ phase: ms < 0 ? 'count' : ms < dur ? 'play' : 'end', sec: ms < 0 ? Math.ceil(-ms / 1000) : 0 });
const short = s => { const c = [...String(s)]; return c.length > 6 ? c.slice(0, 5).join('') + '…' : c.join(''); };

export default function WheelStage({ meta, names, startAt, clock, onEnd, watermark }) {
  const box = useRef(null);
  const [st, setSt] = useState(() => stateAt(clock() - startAt, meta.durationMs));
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const fin = useRef({}); // onEnd 1회 보장 (StrictMode 재실행·끝난 뒤 deps 재실행에도)
  useWakeLock(st.phase !== 'end');

  useEffect(() => {
    const el = box.current;
    el.replaceChildren(); // StrictMode 재마운트 대비: 이전 캔버스가 남아 있으면 비움 (이 div는 React 자식 없음)
    const labels = meta.segs.map(p => short(names[p] ?? `${p + 1}번`));
    const items = meta.segs.map((p, k) => {
      const [bg, fg] = PAL[colorOf(p, meta.n, PAL.length)];
      return { label: labels[k], backgroundColor: bg, labelColor: fg };
    });
    const w = new Wheel(el, {
      items, isInteractive: false, pointerAngle: 0, rotation: wheelAngleAt(meta, clock() - startAt),
      radius: 0.96, borderWidth: 8, borderColor: '#0b1a40', lineWidth: 2, lineColor: 'rgba(255,255,255,.75)',
      // 글자 크기(500px 기준): 칸이 좁을수록 작게 (19칸 ≈ 31 → 360px 폰에서 ~20px). 긴 이름은 라이브러리가 전체를 줄임
      itemLabelFont: FONT, itemLabelFontSizeMax: Math.min(34, Math.floor(190 * Math.sin(Math.PI / meta.segs.length))),
      itemLabelRadius: 0.84, itemLabelRadiusMax: 0.3, // 바깥은 포인터, 안쪽은 허브에 안 가리게
    });
    // 웹폰트(동적 subset)가 늦게 오면 글자 폭 다시 재기. 언마운트 뒤면 resize()가 알아서 무시
    document.fonts?.load(`20px ${FONT}`, labels.join('')).then(() => w.resize(), () => {});

    let raf = 0;
    const loop = () => {
      const ms = clock() - startAt;
      const deg = wheelAngleAt(meta, ms);
      if (deg !== w.rotation) w.rotation = deg; // setter가 다음 프레임 그리기를 예약
      const { phase, sec } = stateAt(ms, meta.durationMs);
      setSt(s => (s.phase === phase && s.sec === sec ? s : { phase, sec }));
      if (phase !== 'end') raf = requestAnimationFrame(loop);
      else if (fin.current.meta !== meta || fin.current.startAt !== startAt) {
        fin.current = { meta, startAt };
        endRef.current?.();
      }
    };
    loop();
    return () => { cancelAnimationFrame(raf); w.remove(); };
  }, [meta, names, startAt, clock]);

  return (
    <div className="wheel-stage">
      {watermark && <p className="wheel-mark">{watermark}</p>}
      <div className="wheel-wrap">
        <div ref={box} className="wheel-cv" role="img" aria-label="돌림판" />
        <svg className="wheel-pin" viewBox="0 0 40 48" aria-hidden="true"><path d="M4 3h32L20 45z" /></svg>
        <div className="wheel-hub" aria-hidden="true" />
        {st.phase === 'count' && (
          <div className="wheel-over">{st.sec <= 3 ? <b className="wheel-count">{st.sec}</b> : <span>곧 시작합니다</span>}</div>
        )}
        {st.phase === 'end' && <p className="wheel-done" aria-live="polite">🎉 {names[meta.winner]}</p>}
      </div>
    </div>
  );
}
