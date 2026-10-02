import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from './supabase';
import { decode } from './marble/engine';

// LIVE 라운드: 송출 중이면 rooms.live_round_id, 아니면 마지막 결과(PLAYING까지 간 최근 라운드).
// 라운드 행은 Realtime + 복귀/주기 재확인, 궤적은 송출 중인 라운드가 PLAYING이 되면 1회만 받는다.
export function useLive(code, liveId) {
  const [round, setRound] = useState(null);
  const [track, setTrack] = useState(null); // { id, data }
  const want = useRef(liveId);
  const seq = useRef(0);          // 겹친 load 중 마지막 요청의 응답만 반영
  const fetching = useRef(null);  // 궤적을 받는 중/받은 라운드 id
  want.current = liveId;

  const load = useCallback(async () => {
    const n = ++seq.current;
    const q = sb.from('game_rounds').select('*').eq('room_code', code);
    const r = liveId
      ? await q.eq('id', liveId).maybeSingle()
      : await q.eq('state', 'PLAYING').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (r.error || n !== seq.current || want.current !== liveId) return;
    setRound(r.data);

    // 궤적은 구슬 레이스만 (돌림판·사다리는 meta로 충분, 반응속도는 live 상태). 대기 화면(송출 아님)도 받지 않음
    const g = r.data;
    if (!liveId || g?.game_type !== 'marble' || g.state !== 'PLAYING' || fetching.current === g.id) return;
    fetching.current = g.id;
    const d = await sb.from('game_replays').select('data').eq('round_id', g.id).maybeSingle();
    if (fetching.current !== g.id || want.current !== liveId) return; // 그사이 다른 라운드로 바뀜
    if (d.error || !d.data) { fetching.current = null; return; }       // 다음 load에서 재시도
    setTrack({ id: g.id, data: decode(d.data.data, g.meta) });
  }, [code, liveId]);

  useEffect(() => {
    load();
    const ch = sb.channel(`live-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rounds', filter: `room_code=eq.${code}` }, () => load())
      .subscribe(st => st === 'SUBSCRIBED' && load()); // 재연결 시 놓친 변경 resync
    const onVis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(load, liveId ? 5000 : 30000); // Realtime 끊김 대비
    return () => {
      sb.removeChannel(ch);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
    };
  }, [code, liveId, load]);

  const ready = round && track?.id === round.id ? track.data : null;
  return { round, track: ready, onAir: !!liveId && round?.id === liveId };
}
