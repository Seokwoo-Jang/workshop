'use client';
import { useState } from 'react';
import { asset } from '@/lib/ui';
import { BADGES, COURSES, FINALE, MAP, NOTE, SPOTS, TEXTS } from '@/lib/courses';

// 🗺 제부도 추천코스: 네이버 지도 캡처 위에 관광안내도처럼 코스 선 + 번호 마커 (SVG 한 장, 폭에 맞춰 축소)
const pts = a => a.map(p => p.join(',')).join(' ');
const tw = (s, fs) => [...s].reduce((w, ch) => w + (ch > '　' ? 1 : ch === ' ' ? 0.3 : 0.6), 0) * fs; // 라벨 폭 어림

function Leg({ kind, pts: p, color }) {
  const d = pts(p);
  return (
    <g className={`course-leg ${kind}`}>
      <polyline points={d} className="course-case" />
      <polyline points={d} className="course-line" stroke={color} />
      {kind === 'bus' && <polyline points={d} className="course-dash" />}
    </g>
  );
}

function Spot({ s, dim }) {
  const [dx, dy] = s.lab;
  const w = Math.max(tw(s.name, 26), s.sub ? tw(s.sub, 18) : 0) + 24;
  const h = s.sub ? 58 : 38;
  const x = dx >= 0 ? s.x + dx : s.x + dx - w;
  const y = s.y + dy - h / 2;
  return (
    <g opacity={dim ? 0.35 : 1}>
      <rect className="course-pill" x={x} y={y} width={w} height={h} rx="9" stroke={s.color} />
      <text className="course-name" x={x + 12} y={y + 28}>{s.name}</text>
      {s.sub && <text className="course-sub" x={x + 12} y={y + 49}>{s.sub}</text>}
      <circle cx={s.x} cy={s.y} r="16" fill={s.color} className="course-pin" />
      <text className="course-no" x={s.x} y={s.y} dy=".36em">{s.n}</text>
    </g>
  );
}

function Steps({ steps, color }) {
  return (
    <ol className="course-steps" style={{ '--c': color }}>
      {steps.map(([t, s], i) => <li key={i}><b>{t}</b><span>{s}</span></li>)}
    </ol>
  );
}

export default function CourseMap() {
  const [sel, setSel] = useState('all');
  const [big, setBig] = useState(false);
  const on = id => sel === 'all' || sel === id;
  const cur = COURSES.find(c => c.id === sel);
  const order = [...COURSES].sort((a, b) => on(a.id) - on(b.id)); // 선택 코스를 맨 위에

  return (
    <div className="course">
      <div className="seg course-seg" role="tablist" aria-label="추천코스">
        {[['all', '전체'], ...COURSES.map(c => [c.id, `${c.icon} ${c.id}`])].map(([id, label]) => (
          <button key={id} role="tab" aria-selected={sel === id} onClick={() => setSel(id)}>{label}</button>
        ))}
      </div>

      <div className={`course-map${big ? ' big' : ''}`}>
        <svg viewBox={MAP.view.join(' ')} role="img" aria-label="제부도 추천코스 지도" onClick={() => setBig(!big)}>
          <image href={asset(MAP.src)} width={MAP.w} height={MAP.h} />
          {order.map(c => (
            <g key={c.id} opacity={on(c.id) ? 1 : 0.18}>
              {c.legs.map((l, i) => <Leg key={i} {...l} color={c.color} />)}
            </g>
          ))}
          {TEXTS.map(t => <text key={t.t} className="course-text" x={t.x} y={t.y}>{t.t}</text>)}
          {BADGES.map((b, i) => (
            <g key={i} transform={`translate(${b.x} ${b.y})`} opacity={[...b.on].some(on) ? 1 : 0.3}>
              <circle r="19" fill="#fff" stroke={b.color} strokeWidth="3" />
              <text className="course-emoji" dy=".35em">{b.icon}</text>
            </g>
          ))}
          {SPOTS.map(s => <Spot key={s.n} s={s} dim={![...s.on].some(on)} />)}
        </svg>
      </div>
      <p className="hint course-cap">지도를 누르면 {big ? '원래 크기로' : '크게 보기'} · 지도: 네이버 지도</p>

      {cur ? (
        <>
          <p className="course-title" style={{ '--c': cur.color }}><i>{cur.id}</i> {cur.icon} {cur.title}</p>
          <Steps steps={cur.steps} color={cur.color} />
        </>
      ) : (
        <ul className="course-list">
          {COURSES.map(c => (
            <li key={c.id}>
              <button className="course-title" style={{ '--c': c.color }} onClick={() => setSel(c.id)}>
                <i>{c.id}</i> {c.icon} {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="course-title" style={{ '--c': FINALE.color }}><i>✓</i> {FINALE.title}</p>
      <Steps steps={FINALE.steps} color={FINALE.color} />
      <p className="hint">{NOTE}</p>
    </div>
  );
}
