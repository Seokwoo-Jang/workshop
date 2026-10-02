'use client';
import { rpc } from '@/lib/supabase';
import { countdown, fmtOpen, useNow } from '@/lib/time';
import { toast, useConfirm } from '@/lib/ui';
import SeatMap from './SeatMap';

export default function SeatTab({ sess, room, seats, people, reload }) {
  const now = useNow(250);
  const [dialog, ask] = useConfirm();
  const names = Object.fromEntries(people.map(p => [p.id, p.name]));
  const openAt = room.seat_open_at ? new Date(room.seat_open_at).getTime() : null;
  const open = openAt !== null && now >= openAt;
  const mine = seats.find(s => s.user_id === sess.participant_id);

  const onSeat = async (s, kind) => {
    try {
      if (kind === 'mine') {
        if (!(await ask(`${s.seat_no}번 좌석 예약을 취소하시겠습니까?`, '예약 취소', true))) return;
        await rpc('cancel_seat', { p_token: sess.token });
        toast(`${s.seat_no}번 좌석 예약을 취소했습니다`);
      } else {
        const q = mine
          ? `${mine.seat_no}번 → ${s.seat_no}번으로 변경하시겠습니까?`
          : `${s.seat_no}번 좌석을 선택하시겠습니까?`;
        if (!(await ask(q, mine ? '변경' : '선택'))) return;
        await rpc('reserve_seat', { p_token: sess.token, p_seat: s.seat_no });
        toast(`${s.seat_no}번 좌석을 예약했습니다`);
      }
    } catch (e) {
      toast(e.message);
    }
    reload(['seats']);
  };

  return (
    <div>
      <h2>좌석 예약</h2>
      <p className="sub">28인승 리무진 · 선착순</p>

      {!open && (
        <div className="open-board">
          {openAt === null ? (
            <p className="open-label">예약 오픈 시각이 아직 정해지지 않았습니다</p>
          ) : (
            <>
              <p className="open-at">{fmtOpen(room.seat_open_at)} OPEN</p>
              <p className="open-count">{countdown(openAt - now)}</p>
              <p className="open-label">예약 시작까지</p>
            </>
          )}
        </div>
      )}

      {mine && <p className="my-seat">내 좌석 <b>{mine.seat_no}번</b></p>}
      {open && !mine && <p className="my-seat">빈 좌석을 눌러 예약하세요</p>}

      <SeatMap seats={seats} names={names} meId={sess.participant_id} onSeat={onSeat}
        disabled={(s, kind) => !open || kind === 'taken' || kind === 'reserved'} />
      {dialog}
    </div>
  );
}
