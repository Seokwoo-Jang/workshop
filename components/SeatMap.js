'use client';
import { SEAT_ROWS } from '@/lib/seatLayout';

// seats: [{seat_no,user_id,reserved}], names: {id: name}
export default function SeatMap({ seats, names, meId, disabled, onSeat }) {
  const by = Object.fromEntries(seats.map(s => [s.seat_no, s]));
  return (
    <>
      <div className="bus" aria-label="버스 좌석표">
        <div className="bus-front">
          <div className="driver"><div className="wheel" aria-hidden />운전석</div>
          <div className="door">출입구</div>
        </div>
        <div className="bus-grid">
          <div className="curtain" style={{ gridColumn: '1 / 3' }}>가림막</div>
          <div className="curtain" style={{ gridColumn: '4 / 5' }}>가림막</div>
          {SEAT_ROWS.flatMap((row, r) => row.map((no, c) => {
            if (no === null) return <div key={`a${r}-${c}`} />;
            const s = by[no] || { seat_no: no };
            const kind = s.reserved ? 'reserved' : !s.user_id ? 'empty' : s.user_id === meId ? 'mine' : 'taken';
            const label = s.reserved ? '운영석' : s.user_id ? names[s.user_id] || '?' : '';
            return (
              <button key={no} className={`seat ${kind}`} disabled={disabled(s, kind)} onClick={() => onSeat(s, kind)}
                aria-label={`${no}번 ${kind === 'empty' ? '빈 좌석' : label}`}>
                <span className="no">{s.reserved ? '🔒' : no}</span>
                {label && <span className="nm">{label}</span>}
              </button>
            );
          }))}
        </div>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--sun)', borderColor: 'var(--sun)' }} />내 좌석</span>
        <span><i style={{ background: 'var(--taken)', borderColor: 'var(--taken)' }} />예약됨</span>
        <span><i style={{ background: 'repeating-linear-gradient(-45deg,var(--mist) 0 3px,#fff 3px 6px)' }} />운영석</span>
      </div>
    </>
  );
}
