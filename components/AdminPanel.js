'use client';
import { useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { ROOM } from '@/lib/session';
import { fmtOpen, fromInputKST, serverNow, toInputKST } from '@/lib/time';
import { toast, useConfirm } from '@/lib/ui';
import { fmtLinks, parseLinks } from '@/lib/courses';
import SeatMap from './SeatMap';
import Invite from './Invite';
import LiveAdmin from './LiveAdmin';
import ShootAdmin from './ShootAdmin';
import PrizeAdmin from './PrizeAdmin';
import BudgetAdmin from './BudgetAdmin';

export default function AdminPanel({ sess, room, seats, people, schedule, scores, live, reload, onClose, onAdminExpired, onResetAll }) {
  const [dialog, ask] = useConfirm();
  const A = sess.admin_token;

  // 공통 실행기: 실패 메시지, 관리자 세션 만료 처리
  const run = async (fn, okMsg, what) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
    } catch (e) {
      if (e.code === 'NOT_ADMIN') { toast(e.message); return onAdminExpired(); }
      toast(e.message);
    }
    reload(what);
  };

  return (
    <div className="admin" role="dialog" aria-modal="true" aria-label="관리자 메뉴">
      <header className="top">
        <div className="wrap">
          <div className="top-title plain">⚙️ 관리자</div>
          <button className="btn ghost small" onClick={onClose}>닫기</button>
        </div>
      </header>
      <main className="wrap body stack" style={{ paddingTop: 16 }}>
        <LiveAdmin {...{ A, sess, room, people, live, ask, reload, onAdminExpired }} />
        <ShootAdmin {...{ A, room, people, scores, run, live }} />
        <PrizeAdmin {...{ A, room, run }} />
        <section className="panel">
          <h3>초대</h3>
          <Invite />
        </section>
        <SeatAdmin {...{ A, room, seats, people, run, ask }} />
        <PeopleAdmin {...{ seats, people }} />
        <ScheduleAdmin {...{ A, schedule, run, ask }} />
        <AlbumAdmin {...{ A, room, run }} />
        <BudgetAdmin {...{ A, run, ask }} />
        <ResetAll {...{ A, ask, onAdminExpired, onResetAll }} />
      </main>
      {dialog}
    </div>
  );
}

// ───────────────────────── 좌석
function SeatAdmin({ A, room, seats, people, run, ask }) {
  const [at, setAt] = useState(toInputKST(room.seat_open_at));
  // 시트를 연 시점의 좌석 스냅샷. 그사이 실시간으로 바뀌면 버튼을 잠그고 안내 (누르려던 버튼이 바뀌지 않게)
  const [act, setAct] = useState(null);
  const [pick, setPick] = useState('');
  useEffect(() => setAt(toInputKST(room.seat_open_at)), [room.seat_open_at]);
  const names = Object.fromEntries(people.map(p => [p.id, p.name]));
  const cur = act && seats.find(s => s.seat_no === act.seat_no);
  const changed = !!act && (!cur || cur.user_id !== act.user_id || cur.reserved !== act.reserved);

  const saveAt = () => run(() => rpc('admin_set_open_at', { p_admin: A, p_at: fromInputKST(at) }),
    at ? '예약 오픈 시각을 저장했습니다' : '오픈 시각을 비웠습니다 (예약 닫힘)', ['room']);

  const reset = async () => {
    if (at && new Date(fromInputKST(at)).getTime() <= serverNow()) {
      return toast('새 오픈 시각을 지금 이후로 바꾼 뒤 리셋하세요 (비워두면 예약 닫힘)');
    }
    const msg = `모든 좌석 예약을 초기화하시겠습니까?\n운영석은 유지됩니다.\n새 오픈 시각: ${at ? at.replace('T', ' ') : '미정 (예약 닫힘)'}`;
    if (!(await ask(msg, '초기화', true))) return;
    run(() => rpc('admin_reset_seats', { p_admin: A, p_at: fromInputKST(at) }), '좌석 예약을 초기화했습니다', ['room', 'seats']);
  };

  const seatAct = (action, user = null) => {
    const s = act;
    setAct(null); setPick('');
    run(() => rpc('admin_seat', { p_admin: A, p_seat: s.seat_no, p_action: action, p_user: user }), '좌석을 변경했습니다', ['seats']);
  };

  return (
    <section className="panel">
      <h3>좌석 예약</h3>
      <div className="field">
        <label htmlFor="openat">예약 오픈 시각 (한국시간)</label>
        <input id="openat" className="input" type="datetime-local" value={at} onChange={e => setAt(e.target.value)} />
        <p className="hint">
          현재: {room.seat_open_at ? `${fmtOpen(room.seat_open_at)} OPEN` : '미정'}
          {' '}· 비워두고 저장하면 예약이 닫힙니다
        </p>
      </div>
      <div className="row">
        <button className="btn primary" onClick={saveAt}>오픈 시각 저장</button>
        <button className="btn ghost" onClick={reset}>🔄 리셋</button>
      </div>
      <p className="hint">리셋: 참가자 예약을 모두 해제하고 위 시각으로 다시 오픈합니다 (복귀편 예약용)</p>

      <p className="hint" style={{ marginTop: 8 }}>좌석을 누르면 운영석 지정 / 해제 / 대리 배정을 할 수 있습니다</p>
      <SeatMap seats={seats} names={names} meId={null} disabled={() => false} onSeat={s => setAct(s)} />

      {act && (
        <div className="scrim" onClick={() => setAct(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <p className="sheet-msg">
              {act.seat_no}번 좌석 · {act.reserved ? '🔒 운영석' : act.user_id ? names[act.user_id] : '빈 좌석'}
            </p>
            {changed && (
              <>
                <p className="err">좌석 상태가 방금 바뀌었습니다.</p>
                <button className="btn primary" onClick={() => setAct(cur || null)}>최신 상태로 다시 보기</button>
              </>
            )}
            {!changed && act.reserved && <button className="btn ghost" onClick={() => seatAct('unreserve')}>운영석 해제</button>}
            {!changed && !act.reserved && !act.user_id && <button className="btn ghost" onClick={() => seatAct('reserve')}>🔒 운영석으로 지정</button>}
            {!changed && act.user_id && <button className="btn ghost" onClick={() => seatAct('release', act.user_id)}>예약 강제 해제</button>}
            <div className="field">
              <label htmlFor="assign">참가자 대리 배정</label>
              <div className="row">
                <select id="assign" className="input" value={pick} onChange={e => setPick(e.target.value)}>
                  <option value="">참가자 선택</option>
                  {people.map(p => {
                    const cur = seats.find(s => s.user_id === p.id);
                    return <option key={p.id} value={p.id}>{p.name}{cur ? ` (현재 ${cur.seat_no}번)` : ''}</option>;
                  })}
                </select>
                <button className="btn primary small" disabled={!pick || changed} onClick={() => seatAct('assign', pick)}>배정</button>
              </div>
              <p className="hint">배정하면 그 참가자의 기존 좌석은 자동 해제됩니다</p>
            </div>
            <button className="btn ghost" onClick={() => setAct(null)}>닫기</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────────────────── 참가자
const KIND = { join: '첫 입장', reconnect_other_device: '다른 기기 재연결', admin_login: '관리자 로그인' };
function PeopleAdmin({ seats, people }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => {
    sb.from('join_logs').select('participant_id,kind,created_at').eq('room_code', ROOM)
      .order('created_at', { ascending: false }).limit(40)
      .then(r => !r.error && setLogs(r.data));
  }, [people]);
  const names = Object.fromEntries(people.map(p => [p.id, p.name]));
  const seatOf = id => seats.find(s => s.user_id === id)?.seat_no;
  const seated = people.filter(p => seatOf(p.id)).length;

  return (
    <section className="panel">
      <h3>참가자 {people.length}명 · 좌석 {seated}명</h3>
      <ul className="admin-list">
        {people.map(p => (
          <li key={p.id}>
            <span className="grow">{p.name}</span>
            <span className="badge">{seatOf(p.id) ? `${seatOf(p.id)}번` : '좌석 없음'}</span>
          </li>
        ))}
      </ul>
      {logs.length > 0 && (
        <>
          <p className="hint" style={{ fontWeight: 700 }}>접속 로그 (최근 40건)</p>
          <ul className="admin-list">
            {logs.map((l, i) => (
              <li key={i}>
                <span className="grow">{names[l.participant_id] || '삭제된 참가자'} <span className="badge">{KIND[l.kind] || l.kind}</span></span>
                <span className="hint">{new Date(l.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ───────────────────────── 일정
const BLANK = { id: null, hhmm: '', icon: '', title: '', place: '', note: '', detail: '', links: '', widget: '' }; // links: '라벨 | URL' 줄

function ScheduleAdmin({ A, schedule, run, ask }) {
  const [f, setF] = useState(BLANK);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const items = [...schedule].sort((a, b) => a.hhmm.localeCompare(b.hhmm));

  const save = () => run(async () => {
    const links = parseLinks(f.links);
    const old = schedule.find(it => it.id === f.id);
    const args = { p_admin: A, p_id: f.id, p_time: f.hhmm, p_icon: f.icon, p_title: f.title, p_place: f.place, p_note: f.note };
    // 상세·링크·위젯이 비어 있고 원래도 없으면 생략 → migrate 전 7인자 함수와도 맞음 (생략 시 서버는 기존 값 유지)
    if (f.detail || links.length || f.widget || old?.detail || old?.links?.length || old?.widget) {
      Object.assign(args, { p_detail: f.detail, p_links: links, p_widget: f.widget });
    }
    await rpc('admin_upsert_schedule', args);
    setF(BLANK);
  }, f.id ? '일정을 수정했습니다' : '일정을 추가했습니다', ['schedule']);

  const del = async it => {
    if (!(await ask(`'${it.hhmm} ${it.title}' 일정을 삭제하시겠습니까?`, '삭제', true))) return;
    run(() => rpc('admin_delete_schedule', { p_admin: A, p_id: it.id }), '일정을 삭제했습니다', ['schedule']);
  };

  return (
    <section className="panel">
      <h3>일정</h3>
      <ul className="admin-list">
        {items.map(it => (
          <li key={it.id}>
            <span className="grow">{it.hhmm} {it.icon} {it.title}</span>
            <button className="btn ghost small" onClick={() => setF({ ...BLANK, ...it, links: fmtLinks(it.links) })}>수정</button>
            <button className="btn ghost small" onClick={() => del(it)}>삭제</button>
          </li>
        ))}
      </ul>
      <div className="stack">
        <p className="hint" style={{ fontWeight: 700 }}>{f.id ? '일정 수정' : '일정 추가'}</p>
        <div className="row">
          <input className="input" type="time" value={f.hhmm} onChange={set('hhmm')} aria-label="시간" style={{ flex: 2 }} />
          <input className="input" placeholder="🚌" value={f.icon} onChange={set('icon')} aria-label="아이콘" maxLength={4} style={{ flex: 1 }} />
        </div>
        <input className="input" placeholder="일정 (예: 클레이사격)" value={f.title} onChange={set('title')} aria-label="일정" />
        <input className="input" placeholder="장소 (선택)" value={f.place} onChange={set('place')} aria-label="장소" />
        <input className="input" placeholder="공지 (선택)" value={f.note} onChange={set('note')} aria-label="공지" />
        <textarea className="input" rows={3} placeholder="상세 내용 (선택, 일정을 누르면 펼쳐짐)" value={f.detail} onChange={set('detail')} aria-label="상세 내용" />
        <textarea className="input" rows={2} placeholder={'지도 링크 (선택)\n서서갈비 | https://naver.me/...'} value={f.links} onChange={set('links')} aria-label="지도 링크" />
        <p className="hint">지도 링크: 한 줄에 하나씩 '라벨 | 주소' (최대 4개)</p>
        <label className="check">
          <input type="checkbox" checked={f.widget === 'courses'} onChange={e => setF({ ...f, widget: e.target.checked ? 'courses' : '' })} />
          🗺 제부도 추천코스 지도 표시
        </label>
        <div className="row">
          {f.id && <button className="btn ghost" onClick={() => setF(BLANK)}>수정 취소</button>}
          <button className="btn primary" onClick={save}>{f.id ? '수정 저장' : '일정 추가'}</button>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── 사진
function AlbumAdmin({ A, room, run }) {
  const [url, setUrl] = useState(room.album_url || '');
  return (
    <section className="panel">
      <h3>공유 앨범 링크</h3>
      <input className="input" type="url" inputMode="url" placeholder="https://photos.app.goo.gl/..."
        value={url} onChange={e => setUrl(e.target.value)} />
      <button className="btn primary" onClick={() => run(() => rpc('admin_set_album', { p_admin: A, p_url: url.trim() }),
        url.trim() ? '앨범 링크를 저장했습니다' : '앨범 링크를 지웠습니다', ['room'])}>링크 저장</button>
    </section>
  );
}

// ───────────────────────── 전체 초기화
function ResetAll({ A, ask, onAdminExpired, onResetAll }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const reset = async () => {
    setErr('');
    if (!(await ask('전체 초기화하시겠습니까?\n참가자, 좌석 예약, 운영석이 모두 지워지고 되돌릴 수 없습니다.\n일정, 앨범 링크, 오픈 시각, 경품 이름, 예산, PIN은 유지됩니다.', '전체 초기화', true))) return;
    try {
      const r = await rpc('admin_reset_all', { p_admin: A, p_pin: pin });
      if (r.status !== 'ok') { setErr('PIN이 맞지 않습니다'); setPin(''); return; }
      onResetAll();
    } catch (e) {
      if (e.code === 'NOT_ADMIN') return onAdminExpired();
      setErr(e.message);
    }
  };

  return (
    <section className="panel">
      <h3>전체 초기화</h3>
      <p className="hint">리허설이 끝나고 실제 행사 전에 사용하세요 (일정·경품 이름·예산 유지). 관리자 본인도 다시 이름을 입력해야 합니다.</p>
      <input className="input" type="password" inputMode="numeric" placeholder="관리자 PIN" maxLength={8}
        value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
      {err && <p className="err">{err}</p>}
      <button className="btn danger" disabled={pin.length < 4} onClick={reset}>🗑 전체 초기화</button>
    </section>
  );
}
