'use client';
import { kstHHMM, useNow } from '@/lib/time';

export default function ScheduleTab({ schedule }) {
  const hhmm = kstHHMM(useNow(30000));
  const items = [...schedule].sort((a, b) => a.hhmm.localeCompare(b.hhmm));
  const cur = items.reduce((i, it, k) => (it.hhmm <= hhmm ? k : i), -1);
  const curT = cur >= 0 ? items[cur].hhmm : null; // 같은 시각 일정(예: 17:30 단체사진·석식)은 함께 강조

  return (
    <div>
      <h2>일정</h2>
      <p className="sub">지금 진행 중인 일정이 강조됩니다</p>
      {items.length === 0 ? <p className="empty-note">등록된 일정이 없습니다</p> : (
        <ol className="sched">
          {items.map((it, k) => (
            <li key={it.id} className={it.hhmm === curT ? 'now' : k < cur ? 'past' : ''}>
              <span className="t">{it.hhmm}</span>
              <span className="dot" aria-hidden />
              <div>
                <div className="what">{it.icon} {it.title}</div>
                {(it.place || it.note) && <div className="meta">{[it.place, it.note].filter(Boolean).join(' / ')}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
