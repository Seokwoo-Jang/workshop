'use client';
import { useEffect, useRef, useState } from 'react';
import { MAPS, decode } from '@/lib/marble/engine';
import { GAMES, prepareRound } from '@/lib/games';
import { randomSeed } from '@/lib/rng';
import { colsWith } from '@/lib/ladder/plan';
import { toast } from '@/lib/ui';
import LiveView, { ResultView } from './LiveView';
import MarbleStage from './MarbleStage';
import WheelStage from './WheelStage';
import LadderStage from './LadderStage';
import ReactionPad from './ReactionPad';
import PeoplePicker from './PeoplePicker';

const WM = '연습 모드 · 결과 무효';

// 🎮 게임: 🔴 LIVE(관리자 송출 관전) / 🕹 연습(내 폰에서만, 결과 저장 안 함)
export default function GameTab({ sess, room, people, live, seg, setSeg }) {
  return (
    <div className="stack">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={seg === 'live'} onClick={() => setSeg('live')}>🔴 LIVE</button>
        <button role="tab" aria-selected={seg === 'free'} onClick={() => setSeg('free')}>🕹 연습</button>
      </div>
      {seg === 'live' ? <LiveView live={live} meId={sess.participant_id} room={room} /> : <Practice people={people} meId={sess.participant_id} />}
    </div>
  );
}

function Practice({ people, meId }) {
  const [game, setGame] = useState('marble');
  const [sel, setSel] = useState(() => new Set(people.map(p => p.id))); // 기본: 전원
  const [map, setMap] = useState(0);
  const [lane, setLane] = useState(-1);   // 🪜 내 출발 번호 (0-based, -1 = 랜덤)
  const [run, setRun] = useState(null);   // { round, meta, track, names, startAt }
  const [ended, setEnded] = useState(false);
  const [busy, setBusy] = useState(false);
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []); // 화면을 떠나면 시뮬레이션 중단
  const players = people.filter(p => sel.has(p.id));
  const meIdx = players.findIndex(p => p.id === meId);
  const myLane = game === 'ladder' && meIdx >= 0 && lane < players.length ? lane : -1; // 인원이 줄면 랜덤으로

  const start = async () => {
    if (players.length < 2) return toast('2명 이상 선택하세요');
    abort.current?.abort();
    abort.current = new AbortController();
    setBusy(true); setRun(null); setEnded(false);
    try {
      const names = players.map(p => p.name);
      const opts = game === 'marble' ? { map } : myLane >= 0 ? { cols: colsWith(players.length, meIdx, myLane) } : {};
      const { meta, data } = await prepareRound(game, names, randomSeed(), { ...opts, signal: abort.current.signal });
      const round = { game_type: game, players, meta, result: meta.ranking.map(i => players[i].id), opts: {}, turn: null };
      setRun({ round, meta, track: game === 'marble' ? decode(data, meta) : null, names, startAt: Date.now() + 3500 });
    } catch (e) {
      if (e.name !== 'AbortError') toast('연습 게임을 시작하지 못했습니다');
    }
    setBusy(false);
  };

  if (run) {
    const g = run.round.game_type; // 시뮬레이션 중에 게임 선택을 바꿔도 결과를 만든 게임으로 그림
    const common = { meta: run.meta, names: run.names, startAt: run.startAt, clock: Date.now, onEnd: () => setEnded(true), watermark: WM };
    return (
      <div className="stack">
        {g === 'marble' && <MarbleStage {...common} track={run.track} />}
        {g === 'wheel' && <WheelStage {...common} />}
        {g === 'ladder' && <LadderStage {...common} meIndex={run.round.players.findIndex(p => p.id === meId)} />}
        {ended && <ResultView round={run.round} meId={meId} practice />}
        <button className="btn ghost" onClick={() => { setRun(null); setEnded(false); }}>다시 설정</button>
      </div>
    );
  }

  return (
    <section className="panel">
      <h3>🕹 연습</h3>
      <p className="hint">내 폰에서만 실행되고 결과는 저장되지 않습니다. LIVE 중에도 연습할 수 있고, LIVE는 [LIVE 보기]로 돌아가면 됩니다.</p>
      <div className="field">
        <label htmlFor="pgame">게임</label>
        <select id="pgame" className="input" value={game} disabled={busy} onChange={e => setGame(e.target.value)}>
          {GAMES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
      </div>
      {game === 'reaction' ? <ReactionPractice /> : (
        <>
          {game === 'marble' && (
            <div className="field">
              <label htmlFor="pmap">맵</label>
              <select id="pmap" className="input" value={map} disabled={busy} onChange={e => setMap(+e.target.value)}>
                {MAPS.map(m => <option key={m.index} value={m.index}>{m.title}</option>)}
              </select>
            </div>
          )}
          <PeoplePicker people={people} sel={sel} setSel={setSel} />
          {game === 'ladder' && meIdx >= 0 && (
            <div className="field">
              <label htmlFor="plane">내 출발 번호</label>
              <select id="plane" className="input" value={myLane} disabled={busy} onChange={e => setLane(+e.target.value)}>
                <option value={-1}>랜덤</option>
                {players.map((_, c) => <option key={c} value={c}>{c + 1}번</option>)}
              </select>
            </div>
          )}
          <button className="btn primary" disabled={busy || players.length < 2} onClick={start}>{busy ? '준비 중…' : '▶️ 연습 시작'}</button>
        </>
      )}
    </section>
  );
}

// ⚡ 반응속도 연습: FINAL과 같은 3판 평균, 부정출발은 무효 후 같은 판 다시 (서버 없음, 몇 번이든 반복)
function ReactionPractice() {
  const [rec, setRec] = useState([]);     // 이번 세트 기록 (3판)
  const [trial, setTrial] = useState(null);
  const [flash, setFlash] = useState(null);
  const done = rec.length >= 3;
  const avg = rec.length ? Math.round(rec.reduce((a, b) => a + b, 0) / rec.length) : null;

  const ready = () => { setFlash(null); setTrial({ key: `${Date.now()}`, delay_ms: 1500 + Math.random() * 2500 }); };
  const onResult = ({ ms, falseStart }) => {
    setTrial(null);
    if (falseStart) return setFlash('너무 빨라요! 무효 — 다시');
    setFlash(`${ms} ms`);
    setRec(r => [...r, ms]);
  };
  const again = () => { setRec([]); setFlash(null); ready(); };

  return (
    <div className="stack">
      <p className="hint">{done ? `3판 평균 ${avg} ms (${rec.join(' / ')})` : `연습 ${rec.length + 1} / 3${rec.length ? ` · ${rec.join(' / ')} ms` : ''}`}</p>
      <ReactionPad trial={trial} onResult={onResult} flash={flash} watermark={WM}
        idle={done
          ? { title: `평균 ${avg} ms`, sub: '다시 해볼까요?', button: '다시 3판', onButton: again }
          : { title: '준비되면', sub: '버튼을 누르고 초록색이 되면 탭', button: rec.length ? '다음 판' : '연습 시작', onButton: ready }} />
    </div>
  );
}
