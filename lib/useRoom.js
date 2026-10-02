import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from './supabase';
import { syncClock } from './time';

// 방 데이터 로드 + Realtime 구독 + 복귀/주기적 재동기화
export function useRoom(code) {
  const [room, setRoom] = useState(undefined); // undefined: 로딩, null: 없음/연결 실패
  const [people, setPeople] = useState([]);
  const [seats, setSeats] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scores, setScores] = useState([]);
  const alive = useRef(true);
  const seq = useRef({}); // 같은 종류 요청이 겹치면 마지막 요청의 응답만 반영

  const load = useCallback(async (what = ['room', 'people', 'seats', 'schedule', 'scores']) => {
    const q = {
      room: () => sb.from('rooms').select('*').eq('code', code).maybeSingle(),
      people: () => sb.from('participants').select('id,name,created_at').eq('room_code', code).order('created_at'),
      seats: () => sb.from('seats').select('seat_no,user_id,reserved').eq('room_code', code).order('seat_no'),
      schedule: () => sb.from('schedule_items').select('*').eq('room_code', code).order('hhmm').order('seq'),
      scores: () => sb.from('scores').select('user_id,score,tiebreak').eq('room_code', code),
    };
    const set = { room: setRoom, people: setPeople, seats: setSeats, schedule: setSchedule, scores: setScores };
    await Promise.all(what.map(async k => {
      const n = (seq.current[k] = (seq.current[k] || 0) + 1);
      const r = await q[k]();
      if (!alive.current || n !== seq.current[k]) return;
      if (!r.error) set[k](r.data);
      else if (k === 'room') setRoom(p => (p === undefined ? null : p)); // 첫 로드 실패 → 안내 화면
    }));
  }, [code]);

  useEffect(() => {
    alive.current = true;
    load();
    const f = `room_code=eq.${code}`;
    // participants는 filter 없음: filter가 걸린 구독에는 DELETE(전체 초기화)가 오지 않는다
    const ch = sb.channel(`room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'seats', filter: f }, () => load(['seats']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => load(['people', 'seats', 'scores']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => load(['scores']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_items' }, () => load(['schedule']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => load(['room']))
      .subscribe(st => st === 'SUBSCRIBED' && load()); // 재연결 시 놓친 변경 resync
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      load();
      syncClock().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(load, 20000); // Realtime 끊김 대비
    return () => {
      alive.current = false;
      sb.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
    };
  }, [code, load]);

  return { room, people, seats, schedule, scores, reload: load };
}
