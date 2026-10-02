'use client';
import { useState } from 'react';
import { rpc } from '@/lib/supabase';
import { MAPS } from '@/lib/marble/engine';
import { GAMES, gameLabel, prepareRound, roundEnded } from '@/lib/games';
import { useNow } from '@/lib/time';
import { toast } from '@/lib/ui';
import LiveView from './LiveView';
import PeoplePicker from './PeoplePicker';
import { ReactionAdmin } from './ReactionLive';

// 🎮 게임 선택 → 👥 참가자 선택 → ▶️ LIVE START
// 구슬·돌림판·사다리: 서버 seed로 이 기기에서 1회 계산 → 업로드 → 전원 동시 재생 (결과는 재생 끝까지 비공개)
// 반응속도: START 즉시 첫 플레이어부터 본게임 3판 (순서는 서버가 무작위, 측정은 플레이어 폰. 연습은 각자 연습 탭)
export default function LiveAdmin({ A, sess, room, people, live, ask, reload, onAdminExpired }) {
  const [game, setGame] = useState('marble');
  const [map, setMap] = useState(0);
  const [final, setFinal] = useState(3);
  const [prizes, setPrizes] = useState(false); // FINAL 백업 시상 (구슬·사다리 1~3위에 특별상품)
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // 진행 문구
  const players = people.filter(p => sel.has(p.id));
  const { round, onAir } = live;
  const preparing = onAir && round.state === 'PREPARING';

  const fail = e => {
    toast(e.message || '처리하지 못했습니다');
    if (e.code === 'NOT_ADMIN') onAdminExpired();
  };

  const fin = n => (prizes ? 0 : Math.max(0, Math.min(final, n - 2)));
  const optsFor = n => (game === 'marble' ? { map, final: fin(n), prizes }
    : game === 'ladder' ? { final: fin(n), prizes } : {});

  // seed로 결과 계산 → 업로드. 같은 seed·참가자·옵션이면 결과가 항상 같으므로 재시도해도 리롤이 아님
  const prepUpload = async ({ id, game: g, seed, names, opts }) => {
    setBusy(g === 'marble' ? '시뮬레이션 중… 0%' : '준비 중…');
    const { meta, data } = await prepareRound(g, names, seed, opts, p => setBusy(`시뮬레이션 중… ${Math.round(p * 100)}%`));
    setBusy('업로드 중…');
    await rpc('admin_live_upload', { p_admin: A, p_round: id, p_meta: meta, p_data: data });
    toast('▶️ LIVE START — 잠시 후 모든 화면에서 동시 재생');
  };

  const start = async () => {
    const n = players.length;
    const opts = optsFor(n);
    const names = players.map(p => p.name);
    const fl = opts.prizes ? '🏆 FINAL 백업 시상' : opts.final ? `하위 ${opts.final}명 FINAL 진출` : '';
    const extra = game === 'marble' ? `\n${fl ? `${fl} · ` : ''}${MAPS[map].title}`
      : game === 'ladder' ? (fl ? `\n${fl}` : '')
      : game === 'wheel' ? ''
      : '\n바로 본게임 3판 시작 (순서는 서버가 무작위로 정함)';
    if (!(await ask(`${gameLabel(game)}\n선택된 참가자 ${n}명: ${names.join(', ')}${extra}\n시작할까요?`, '▶️ START'))) return;
    setBusy('라운드 생성 중…');
    try {
      const r = await rpc('admin_live_start', { p_admin: A, p_game: game, p_players: players.map(p => p.id), p_opts: opts });
      reload(['room']);
      if (game === 'reaction') toast('⚡ 반응속도 시작 — 첫 플레이어 본게임 1판');
      else await prepUpload({ id: r.id, game, seed: r.seed, names, opts });
    } catch (e) { fail(e); }
    setBusy(null);
  };

  // 업로드 실패 / 계산 중 패널 닫힘·기기 재시작 → 같은 라운드를 같은 seed로 다시
  const retry = async () => {
    try {
      await prepUpload({ id: round.id, game: round.game_type, seed: Number(round.seed), names: round.players.map(p => p.name), opts: round.opts });
    } catch (e) { fail(e); }
    setBusy(null);
  };

  const stop = async () => {
    if (!(await ask('송출을 종료할까요?\n참가자 화면은 직전 결과(끝난 경우)와 LIVE 대기 안내로 바뀝니다.', '⏹ 송출 종료', true))) return;
    try { await rpc('admin_live_stop', { p_admin: A }); toast('송출을 종료했습니다'); } catch (e) { fail(e); }
    reload(['room']);
  };

  const limit = game === 'reaction' ? '2~8명 (FINAL은 3명)' : '2명 이상';

  return (
    <section className="panel">
      <h3>🔴 LIVE 송출</h3>
      {onAir && (
        <>
          <p className="hint" style={{ fontWeight: 700 }}>관전 미리보기 · {gameLabel(round.game_type)}</p>
          <div className="preview"><LiveView live={live} meId={sess.participant_id} room={room} /></div>
          {round.state === 'PLAYING' && (round.game_type === 'marble' || round.game_type === 'ladder') && !round.opts?.prizes && <DrawTurn A={A} round={round} fail={fail} />}
          {round.state === 'PLAYING' && round.game_type === 'reaction' && <ReactionAdmin A={A} round={round} ask={ask} fail={fail} />}
          {preparing && !busy && (
            <>
              <p className="hint">결과 계산/업로드가 끝나지 않은 라운드입니다. 같은 seed로 다시 시도하면 결과는 그대로입니다.</p>
              <button className="btn sun" onClick={retry}>🔁 같은 seed로 다시 업로드</button>
            </>
          )}
          <button className="btn danger" onClick={stop}>⏹ 송출 종료</button>
        </>
      )}
      {/* 송출 종료 뒤에도 직전 결과(대기 화면에 계속 보임)의 순번 안내를 이어가거나 끌 수 있게 */}
      {!onAir && round?.state === 'PLAYING' && (round.game_type === 'marble' || round.game_type === 'ladder') && !round.opts?.prizes && (
        <>
          <p className="hint" style={{ fontWeight: 700 }}>직전 결과 · {gameLabel(round.game_type)} (대기 화면에 표시 중)</p>
          <DrawTurn A={A} round={round} fail={fail} />
        </>
      )}

      <div className="field">
        <label htmlFor="lgame">🎮 게임</label>
        <select id="lgame" className="input" value={game} onChange={e => setGame(e.target.value)}>
          {GAMES.map(g => <option key={g.key} value={g.key}>{g.label} — {g.use}</option>)}
        </select>
      </div>
      {(game === 'marble' || game === 'ladder') && (
        <div className="row">
          {game === 'marble' && (
            <div className="field" style={{ flex: 2 }}>
              <label htmlFor="lmap">맵</label>
              <select id="lmap" className="input" value={map} onChange={e => setMap(+e.target.value)}>
                {MAPS.map(m => <option key={m.index} value={m.index}>{m.title}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lfin">FINAL 인원</label>
            <input id="lfin" className="input" type="number" inputMode="numeric" min={0} max={10} value={final}
              onChange={e => setFinal(Math.max(0, Math.min(10, +e.target.value || 0)))} />
          </div>
        </div>
      )}
      {(game === 'marble' || game === 'ladder') && <p className="hint">FINAL 인원: {game === 'marble' ? '마지막에 도착한' : '사다리 맨 오른쪽'} N명이 FINAL 진출 (0이면 전체 순위)</p>}
      {(game === 'marble' || game === 'ladder') && (
        <label className="check">
          <input type="checkbox" checked={prizes} onChange={e => setPrizes(e.target.checked)} />
          <span>🏆 FINAL 백업 시상 — 반응속도 대신 FINAL 3명 순위 결정 (1~3위 특별상품, 3위부터 공개)</span>
        </label>
      )}
      {game === 'wheel' && <p className="hint">선택한 참가자 중 1명 당첨 (인원이 적으면 이름을 반복 배치, 확률은 같음)</p>}
      <PeoplePicker people={people} sel={sel} setSel={setSel} />
      <p className="hint">참가 인원: {limit}</p>
      <button className="btn primary" disabled={!!busy || preparing || players.length < 2 || (game === 'reaction' && players.length > 8)} onClick={start}>
        {busy || '▶️ LIVE START'}
      </button>
      {preparing && !busy && <p className="hint">준비 중인 라운드가 있으면 START할 수 없습니다 (다시 업로드 또는 송출 종료)</p>}
      {onAir && !preparing && <p className="hint">START하면 지금 송출 중인 화면이 새 라운드로 바뀝니다</p>}
    </section>
  );
}

// 📢 선택 순번 안내: 재생이 끝난 뒤 [다음 ▶]으로 차례 진행 (뒤로 가기 가능)
function DrawTurn({ A, round, fail }) {
  const now = useNow(1000);
  if (!roundEnded(round, now)) return <p className="hint">재생 중… 결과는 재생이 끝나면 공개됩니다</p>;
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const picks = round.result.slice(0, round.result.length - (round.opts?.final || 0));
  const t = round.turn;
  const set = v => rpc('admin_draw_turn', { p_admin: A, p_round: round.id, p_turn: v }).catch(fail);

  if (t === null || t === undefined) {
    return <button className="btn sun" onClick={() => set(0)}>📢 선택 순번 안내 시작</button>;
  }
  return (
    <div className="stack">
      <p className="turn">
        {t < picks.length ? <>지금 차례: <b>{name[picks[t]]}</b> ({t + 1} / {picks.length})</> : '✅ 선택 완료'}
      </p>
      <div className="row">
        <button className="btn ghost" disabled={t <= 0} onClick={() => set(t - 1)}>◀ 이전</button>
        <button className="btn primary" disabled={t >= picks.length} onClick={() => set(t + 1)}>다음 ▶</button>
      </div>
      <button className="btn ghost small" onClick={() => set(null)}>순번 안내 끄기</button>
    </div>
  );
}
