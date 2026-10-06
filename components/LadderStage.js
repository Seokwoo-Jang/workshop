'use client';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ladderOf } from '@/lib/ladder/plan';
import { CHIP_HEIGHT, FLAP_HEIGHT, lanePath, layout, maxBoardWidth, minBoardWidth, round, trace } from '@/lib/ladder/whozzie';
import { useWakeLock } from '@/lib/ui';

// 🪜 사다리타기 재생. clock() - startAt 만큼 진행된 장면을 그린다 → 중간 접속/복귀해도 같은 지점부터.
// 보드 좌표·경로는 whozzie(layout/lanePath). 폰: 가로 스크롤 + 가로줄 구간만 세로로 눌러 70dvh 안에 (글자 크기는 유지)
// 모든 줄이 동시에 내려가 durationMs에 도착 → 결과판에 이름 공개 + onEnd 1회
const S_MIN = 0.75; // 화면 px / 보드 단위 최소 배율. 더 줄이면 이름이 안 읽힘 → 대신 가로 스크롤
const K_MIN = 0.3;  // 가로줄 구간 세로 압축 하한
const NAME_PX = 15; // 칩 이름 글자 크기 (보드 단위)
const hue = p => `hsl(${Math.round(p * 137.508) % 360}, 72%, 44%)`; // 황금각 → 번호가 붙은 참가자끼리도 색이 멀다
// 경과 ms → 단계 (count: 시작 전, sec = 남은 초)
const stAt = (ms, dur) => ({ phase: ms < 0 ? 'count' : ms < dur ? 'play' : 'end', sec: ms < 0 ? Math.ceil(-ms / 1000) : 0 });

// 폭(em)에 맞춰 이름 자르기. 한글 등은 1em, 영문·숫자는 0.6em 근사 (SVG text엔 말줄임이 없음)
function fit(s, em) {
  const w = ch => (ch.codePointAt(0) > 0x2e7f ? 1 : 0.6);
  let t = 0;
  for (const ch of s) t += w(ch);
  if (t <= em) return s;
  let out = '';
  t = 0.9; // '…' 자리
  for (const ch of s) { if ((t += w(ch)) > em) break; out += ch; }
  return out + '…';
}
const noEm = k => String(k).length * 0.5 + 0.3; // 칩 앞 출발 번호(12px) + 띄어쓰기 폭, 이름 글자(em) 기준

// lanePath의 d("M x yL x y…") → 꺾은선, 그리고 그 위 거리 t 지점
const polyline = d => d.slice(1).split('L').map(s => s.split(' ').map(Number));
function pointAt(ps, t) {
  for (let i = 1; i < ps.length; i++) {
    const [x0, y0] = ps[i - 1], [x1, y1] = ps[i], len = Math.hypot(x1 - x0, y1 - y0);
    if (t <= len || i === ps.length - 1) {
      const f = len ? Math.min(1, Math.max(0, t / len)) : 0;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
    t -= len;
  }
  return ps[0];
}

// 화면 폭 w, 목표 높이 h(px) → 배율 s, 보드 폭 bw(단위), 좌표 g, 참가자별 경로.
// 칩·결과판은 그대로 두고 가로줄 구간만 k배로 눌러 높이를 맞춘다 (rungY 아핀 변환이라 순서·교차는 그대로)
function build(meta, w, h) {
  const n = meta.n, ladder = ladderOf(meta);
  const s = Math.min(1, Math.max(S_MIN, w / minBoardWidth(n)));
  const bw = Math.min(maxBoardWidth(n), Math.max(minBoardWidth(n), w / s));
  const g0 = layout(bw, ladder);
  const top = g0.ladderTop, span = g0.ladderBottom - top;
  const k = Math.min(1, Math.max(K_MIN, (h / s - (g0.height - span)) / span));
  const cut = span * (1 - k);
  const g = {
    ...g0,
    rungY: (r, c) => top + (g0.rungY(r, c) - top) * k,
    flapTop: c => g0.flapTop(c) - cut,
    ladderBottom: g0.ladderBottom - cut,
    height: g0.height - cut,
  };
  const lanes = meta.cols.map(c => {
    const { d, length } = lanePath(trace(ladder, c), g);
    return { d, length, ps: polyline(d), dash: round(length + 2) };
  });
  return { w, s, bw, g, lanes };
}

export default function LadderStage({ meta, names, startAt, clock, onEnd, watermark, final, meIndex }) {
  const scRef = useRef(null);
  const laneRef = useRef([]), headRef = useRef([]), underRef = useRef(null);
  const [box, setBox] = useState(null); // { w: 스크롤 영역 폭, h: 목표 높이 70dvh }
  const [st, setSt] = useState(() => stAt(clock() - startAt, meta.durationMs)); // 첫 화면부터 맞는 단계 (늦게 들어와도 '0' 깜빡임 없음)
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const fired = useRef(null);
  const follow = useRef(true); // 내 줄 따라 가로 자동 스크롤. 손으로 가로로 밀면 중단
  useWakeLock(st.phase !== 'end');

  const n = meta.n, fin = final ?? meta.final ?? 0;
  const me = Number.isInteger(meIndex) && meIndex >= 0 && meIndex < n ? meIndex : -1;
  const b = useMemo(() => box && build(meta, box.w, box.h), [meta, box]);
  const inv = useMemo(() => meta.cols.reduce((a, c, p) => ((a[c] = p), a), []), [meta]); // 출발 칸 → 참가자

  // 크기 측정. 주소창 접힘/펼침 정도의 높이 변화는 무시 (보드가 출렁이지 않게). layout effect → 첫 페인트부터 보드
  useLayoutEffect(() => {
    const el = scRef.current;
    const measure = () => setBox(o => {
      const w = el.clientWidth, h = Math.round(window.innerHeight * 0.7);
      return o && o.w === w && Math.abs(o.h - h) < 120 ? o : { w, h };
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // 프레임마다 DOM 속성만 갱신 (React 리렌더는 단계·초가 바뀔 때만).
  // layout effect: 새 보드(회전 등)가 커밋되면 페인트 전에 진행 지점을 칠해 빈 줄이 한 프레임 보이지 않게
  useLayoutEffect(() => {
    if (!b) return;
    const sc = scRef.current;
    let raf = 0, last = -1; // last: 직전 프레임에 맞춘 scrollLeft. 그새 바뀌었으면 사용자가 가로로 민 것 (세로 스와이프는 무관)
    const loop = () => {
      const ms = clock() - startAt;
      const p = Math.min(1, Math.max(0, ms / meta.durationMs));
      if (me >= 0 && follow.current) { // 스크롤 읽기/쓰기는 DOM 갱신 전에 (강제 레이아웃 방지)
        if (last >= 0 && Math.abs(sc.scrollLeft - last) > 1) follow.current = false;
        else {
          const { length, ps } = b.lanes[me];
          sc.scrollLeft = pointAt(ps, length * p)[0] * b.s - b.w / 2;
          last = sc.scrollLeft;
        }
      }
      b.lanes.forEach(({ length, ps, dash }, i) => {
        const off = round(dash - length * p);
        laneRef.current[i]?.setAttribute('stroke-dashoffset', off);
        if (i === me) underRef.current?.setAttribute('stroke-dashoffset', off);
        const [x, y] = pointAt(ps, length * p);
        headRef.current[i]?.setAttribute('transform', `translate(${round(x)} ${round(y)})`);
      });
      const s = stAt(ms, meta.durationMs);
      setSt(o => (o.phase === s.phase && o.sec === s.sec ? o : s));
      if (s.phase !== 'end') raf = requestAnimationFrame(loop);
      else if (fired.current !== startAt) { fired.current = startAt; endRef.current?.(); }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [b, me, startAt, clock, meta.durationMs]);

  const ended = st.phase === 'end';

  return (
    <div className="ladder-stage">
      <div ref={scRef} className="ladder-scroll">
        {b && <Board b={b} meta={meta} names={names} inv={inv} me={me} fin={fin} ended={ended}
          laneRef={laneRef} headRef={headRef} underRef={underRef} />}
      </div>
      {b && b.bw * b.s > box.w + 4 && <p className="ladder-hint">↔ 좌우로 밀어서 전체 보기</p>}
      {st.phase === 'count' && (
        <div className="stage-over">{st.sec <= 3 ? <b className="count">{st.sec}</b> : <span>곧 시작합니다</span>}</div>
      )}
      {watermark && <div className="watermark">{watermark}</div>}
    </div>
  );
}

function Board({ b, meta, names, inv, me, fin, ended, laneRef, headRef, underRef }) {
  const { s, bw, g, lanes } = b, n = meta.n;
  const order = [...lanes.keys()].filter(i => i !== me).concat(me >= 0 ? [me] : []); // 내 줄은 맨 위에
  const lw = g.labelWidth, fw = g.flapWidth;
  return (
    <svg className="ladder-svg" width={round(bw * s)} height={round(g.height * s)}
      viewBox={`0 0 ${round(bw)} ${round(g.height)}`} role="img" aria-label="사다리타기 화면">
      <g className="ladder-rail">
        {inv.map((_, c) => <line key={c} x1={round(g.x(c))} x2={round(g.x(c))} y1={g.lineTop(c)} y2={round(g.flapTop(c))} />)}
        {meta.rungs.flatMap((row, r) => row.map((on, c) => {
          if (!on) return null;
          const y = round(g.rungY(r, c));
          return <line key={`${r}:${c}`} x1={round(g.x(c))} x2={round(g.x(c + 1))} y1={y} y2={y} />;
        }))}
      </g>
      {order.map(i => {
        const { d, dash } = lanes[i];
        const da = `${dash} ${dash}`;
        return (
          <g key={i}>
            {i === me && <path ref={underRef} className="ladder-under" d={d} strokeDasharray={da} strokeDashoffset={dash} />}
            <path ref={el => { laneRef.current[i] = el; }} className={`ladder-lane${i === me ? ' me' : ''}`}
              d={d} stroke={hue(i)} strokeDasharray={da} strokeDashoffset={dash} />
          </g>
        );
      })}
      {inv.map((p, c) => {
        const x = g.x(c), y = g.chipTop(c);
        return (
          <g key={c} className={`ladder-chip${p === me ? ' me' : ''}`}>
            <rect x={round(x - lw / 2)} y={y} width={round(lw)} height={CHIP_HEIGHT} rx="8" style={{ stroke: hue(p) }} />
            <text x={round(x)} y={y + CHIP_HEIGHT / 2} dy=".35em">
              <tspan className="ladder-no">{c + 1}</tspan> {fit(names[p] ?? '', (lw - 12) / NAME_PX - noEm(c + 1))}
            </text>
          </g>
        );
      })}
      {order.map(i => {
        const [x, y] = lanes[i].ps[0];
        return <circle key={i} ref={el => { headRef.current[i] = el; }} className={`ladder-head${i === me ? ' me' : ''}`}
          r={i === me ? 9 : 6} fill={hue(i)} transform={`translate(${x} ${y})`} />;
      })}
      {inv.map((_, c) => { // 도착 칸 c의 순위 j (slot 없으면 왼쪽부터 1위)
        const j = meta.slot ? meta.slot[c] : c, p = meta.ranking[j];
        const x = g.x(c), y = round(g.flapTop(c)), isFin = j >= n - fin;
        const tag = isFin ? '⚡FINAL' : fin === 0 ? `${j + 1}번째` : `${j + 1}위`; // FINAL 없음 = 순서 (출발 번호 'N번'과 구분)
        return (
          <g key={c} className={`ladder-flap${isFin ? ' fin' : ''}${ended && p === me ? ' me' : ''}`}>
            <rect x={round(x - fw / 2)} y={y} width={round(fw)} height={FLAP_HEIGHT} rx="6" style={ended ? { stroke: hue(p) } : undefined} />
            {ended ? (
              <>
                <text className="ladder-tag" x={round(x)} y={y + 12} dy=".35em">{tag}</text>
                <text className="ladder-nm" x={round(x)} y={y + 30} dy=".35em">{fit(names[p] ?? '', (fw - 8) / 14)}</text>
              </>
            ) : <text x={round(x)} y={y + FLAP_HEIGHT / 2} dy=".35em">{tag}</text>}
          </g>
        );
      })}
    </svg>
  );
}
