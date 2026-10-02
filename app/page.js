'use client';
import { useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { ROOM, clearSession, getSession, patchSession, setSession } from '@/lib/session';
import { syncClock } from '@/lib/time';
import { asset, toast } from '@/lib/ui';
import { useRoom } from '@/lib/useRoom';
import { useLive } from '@/lib/useLive';
import JoinForm from '@/components/JoinForm';
import SeatTab from '@/components/SeatTab';
import ShootTab from '@/components/ShootTab';
import GameTab from '@/components/GameTab';
import ScheduleTab from '@/components/ScheduleTab';
import PhotoTab from '@/components/PhotoTab';
import AdminPanel from '@/components/AdminPanel';
import AdminPin from '@/components/AdminPin';
import ReactionPlayer from '@/components/ReactionPlayer';
import Toaster from '@/components/Toaster';

const TABS = [
  ['seat', '🚌', '좌석'],
  ['shoot', '🎯', '사격'],
  ['game', '🎮', '게임'],
  ['plan', '📅', '일정'],
  ['photo', '📸', '사진'],
];

export default function Home() {
  const data = useRoom(ROOM);
  const live = useLive(ROOM, data.room?.live_round_id ?? null);
  const [sess, setSess] = useState(undefined); // undefined: 확인 중, null: 이름 입력 필요
  const [tab, setTab] = useState('seat');
  const [seg, setSeg] = useState('live');      // 🎮 게임 탭 세그먼트: live | free
  const [pinOpen, setPinOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const seenLive = useRef(undefined);

  // 저장된 세션 검증
  const verify = async () => {
    const s = getSession();
    if (!s) return setSess(null);
    try {
      const w = await rpc('whoami', { p_token: s.token });
      if (!w) { clearSession(); return setSess(null); }
      const next = { ...s, name: w.name };
      if (s.admin_token && !(await rpc('is_admin_session', { p_admin: s.admin_token }))) next.admin_token = undefined;
      setSess(setSession(next));
    } catch {
      setSess(s); // 오프라인이면 저장값으로 진행, 쓰기 요청은 서버가 다시 검증
    }
  };

  useEffect(() => {
    syncClock().catch(() => {});
    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자가 전체 초기화하면 내 참가자 정보가 사라짐 → 서버 재확인 후 이름 입력으로
  useEffect(() => {
    if (sess && data.room && !data.people.some(p => p.id === sess.participant_id)) verify();
  }, [data.people]); // eslint-disable-line react-hooks/exhaustive-deps

  // 관리자 권한이 어떤 경로로든 사라지면 패널도 닫음 (안 닫으면 게임 탭이 빈 화면으로 남음)
  useEffect(() => {
    if (!sess?.admin_token) setAdminOpen(false);
  }, [sess?.admin_token]);

  // 서버가 토큰을 거부(NOT_JOINED)하면 재확인
  useEffect(() => {
    const on = () => verify();
    window.addEventListener('ws-expired', on);
    return () => window.removeEventListener('ws-expired', on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔴 새 송출 알림만 (화면은 강제로 바꾸지 않음 → 하던 일이 끊기지 않게). 이동은 🎮 탭 LIVE 표시 / [LIVE 보기] 버튼
  const liveId = data.room?.live_round_id ?? null;
  useEffect(() => {
    if (!sess || data.room === undefined) return;
    const prev = seenLive.current;
    seenLive.current = liveId;
    if (!liveId || liveId === prev || adminOpen || (tab === 'game' && seg === 'live')) return;
    toast('🔴 LIVE 시작! 아래 [LIVE 보기]를 누르세요');
  }, [liveId, !!sess]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.room === null) {
    return (
      <div className="wrap land">
        <div>
          <h2>서버에 연결할 수 없습니다</h2>
          <p className="sub">네트워크를 확인하세요. 계속되면 관리자에게 알려주세요 (Supabase schema.sql 실행 여부).</p>
        </div>
      </div>
    );
  }

  if (sess === undefined || data.room === undefined) return <div className="wrap land"><p className="sub">불러오는 중…</p></div>;
  if (sess === null) return <JoinForm onJoined={s => setSess(s)} />;

  const isAdmin = !!sess.admin_token;
  const rx = live.onAir && live.round?.game_type === 'reaction' && live.round.state === 'PLAYING' ? live.round.live : null;
  const myReaction = rx?.phase === 'TURN' && rx.queue?.[rx.turn] === sess.participant_id;
  const dropAdmin = () => setSess(patchSession({ admin_token: undefined }));
  const showFab = live.onAir && !(tab === 'game' && seg === 'live') && !adminOpen; // LIVE 중인데 다른 화면에 있으면
  const goLive = () => { setTab('game'); setSeg('live'); };

  return (
    <>
      <header className="top">
        <div className="wrap">
          <img className="brand" src={asset('/fadu-logo.png')} alt="FADU" width={125} height={22} />
          <div className="top-title">2026 IP TEAM<br />WORKSHOP</div>
          <div className="top-me">👤 {sess.name}</div>
          {isAdmin && <button className="top-gear" aria-label="관리자 메뉴" onClick={() => setAdminOpen(true)}>⚙️</button>}
        </div>
      </header>

      <main className={`wrap body${showFab ? ' fab-pad' : ''}`}>
        {tab === 'seat' && <SeatTab sess={sess} {...data} />}
        {tab === 'shoot' && <ShootTab sess={sess} room={data.room} people={data.people} scores={data.scores} />}
        {tab === 'game' && !adminOpen && ( // 패널이 덮고 있으면 재생 중복 방지 (패널 안 미리보기만)
          <GameTab sess={sess} room={data.room} people={data.people} live={live} seg={seg} setSeg={setSeg} />
        )}
        {tab === 'plan' && <ScheduleTab schedule={data.schedule} />}
        {tab === 'photo' && <PhotoTab room={data.room} />}
        <button className="admin-mode" onClick={() => (isAdmin ? dropAdmin() : setPinOpen(true))}>
          {isAdmin ? '관리자 모드 해제' : '관리자 모드'}
        </button>
      </main>

      <nav className="tabs" aria-label="메뉴">
        <div className="wrap">
          {TABS.map(([k, icon, label]) => (
            <button key={k} className="tab" aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)}>
              <span aria-hidden>{icon}</span>{label}
              {k === 'game' && live.onAir && <i className="live-dot" aria-label="LIVE 진행 중">LIVE</i>}
            </button>
          ))}
        </div>
      </nav>

      {showFab && <button className="live-fab" onClick={goLive}><i aria-hidden /> LIVE 보기</button>}

      {pinOpen && (
        <AdminPin sess={sess} onClose={() => setPinOpen(false)}
          onOk={t => { setSess(patchSession({ admin_token: t })); setPinOpen(false); }} />
      )}

      {adminOpen && isAdmin && (
        <AdminPanel sess={sess} {...data} live={live}
          onClose={() => setAdminOpen(false)}
          onAdminExpired={() => { dropAdmin(); setAdminOpen(false); }}
          onResetAll={() => { clearSession(); setAdminOpen(false); setSess(null); }} />
      )}

      {/* ⚡ FINAL: 내 차례면 어느 화면에 있든(관리자 패널 포함) 플레이 화면을 위에 띄움 */}
      {myReaction && <ReactionPlayer round={live.round} sess={sess} />}

      <Toaster />
    </>
  );
}
