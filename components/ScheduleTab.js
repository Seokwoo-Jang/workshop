'use client';
import { useState } from 'react';
import { kstHHMM, useNow } from '@/lib/time';
import CourseMap from './CourseMap';

const okUrl = u => /^https?:\/\//.test(u || '');

export default function ScheduleTab({ schedule }) {
  const hhmm = kstHHMM(useNow(30000));
  const [open, setOpen] = useState({}); // 펼친 일정 id → true (여러 개 가능)
  const items = [...schedule].sort((a, b) => a.hhmm.localeCompare(b.hhmm));
  const cur = items.reduce((i, it, k) => (it.hhmm <= hhmm ? k : i), -1);
  const curT = cur >= 0 ? items[cur].hhmm : null; // 같은 시각 일정(예: 17:30 단체사진·석식)은 함께 강조

  return (
    <div>
      <h2>일정</h2>
      <p className="sub">지금 진행 중인 일정이 강조됩니다 · ▾ 일정은 눌러서 상세 보기</p>
      {items.length === 0 ? <p className="empty-note">등록된 일정이 없습니다</p> : (
        <ol className="sched">
          {items.map((it, k) => {
            const links = (it.links || []).filter(l => okUrl(l.url));
            const more = !!(it.detail || links.length || it.widget); // 상세 없는 일정은 펼치지 않음
            const on = more && !!open[it.id];
            const head = (
              <>
                <span className="t">{it.hhmm}</span>
                <span className="dot" aria-hidden />
                <span>
                  <span className="what">{it.icon} {it.title}</span>
                  {(it.place || it.note) && <span className="meta">{[it.place, it.note].filter(Boolean).join(' / ')}</span>}
                </span>
              </>
            );
            return (
              <li key={it.id} className={it.hhmm === curT ? 'now' : k < cur ? 'past' : ''}>
                {more ? (
                  <button className="sched-row" aria-expanded={on} aria-controls={`sd-${it.id}`}
                    onClick={() => setOpen(o => ({ ...o, [it.id]: !o[it.id] }))}>
                    {head}
                    <span className="sched-chev" aria-hidden>▾</span>
                  </button>
                ) : head}
                {on && (
                  <div className="sched-more" id={`sd-${it.id}`}>
                    {it.detail && <p className="sched-detail">{it.detail}</p>}
                    {it.place && <p className="sched-place">📍 {it.place}</p>}
                    {links.length > 0 && (
                      <div className="sched-links">
                        {links.map((l, i) => (
                          <a key={i} className="sched-link" href={l.url} target="_blank" rel="noopener noreferrer">🗺 {l.label}</a>
                        ))}
                      </div>
                    )}
                    {it.widget === 'courses' && <CourseMap />}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
