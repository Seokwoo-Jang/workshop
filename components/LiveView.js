'use client';
import { useMemo, useState } from 'react';
import { stageOf } from '@/lib/marble/engine';
import { gameLabel, roundEnded } from '@/lib/games';
import { RULES, finalPrizes } from '@/lib/prizes';
import { serverNow, useNow } from '@/lib/time';
import { useWakeLock } from '@/lib/ui';
import MarbleStage from './MarbleStage';
import WheelStage from './WheelStage';
import LadderStage from './LadderStage';
import LadderPick from './LadderPick';
import ReactionLive, { Podium, ReactionResult } from './ReactionLive';

// 🔴 LIVE 화면 (게임 탭 + 관리자 패널 미리보기 공용)
export default function LiveView({ live, meId, room }) {
  const { round, track, onAir } = live;
  const now = useNow(1000);
  useWakeLock(onAir); // 송출 중(대기·재생·순번 안내)에는 화면 켜둠

  if (!onAir) return <Waiting last={roundEnded(round, now) ? round : null} meId={meId} room={room} />;
  if (round.state === 'PREPARING') {
    // 🪜 사다리: 번호 고르기(PICK) → 마감 후 계산 대기(CLOSED)
    if (round.game_type === 'ladder' && round.live?.phase) return <LadderPick key={round.id} round={round} meId={meId} />;
    return (
      <div className="live-wait">
        <p className="live-badge">🔴 LIVE</p>
        <h3>{gameLabel(round.game_type)} 준비 중…</h3>
        <p className="hint">참가자 {round.players.length}명 · 잠시 후 모든 화면에서 동시에 시작합니다</p>
        <p className="hint">{round.players.map(p => p.name).join(', ')}</p>
      </div>
    );
  }
  // 송출 종료 직후 등 순간적으로 취소된 라운드가 보일 수 있음 → 재생 데이터 없이 Replay로 가지 않게
  if (round.state !== 'PLAYING') return <Waiting last={null} meId={meId} room={room} />;
  if (round.game_type === 'reaction') return round.live ? <ReactionLive round={round} meId={meId} room={room} /> : null;
  if (!round.meta) return <div className="live-wait"><p className="hint">불러오는 중…</p></div>;
  if (round.game_type === 'marble' && !track) {
    // 순번 안내 단계에 늦게 들어온 폰: 궤적(수백 KB) 없이 결과부터
    if (roundEnded(round, now)) return <ResultView round={round} meId={meId} room={room} />;
    return <div className="live-wait"><p className="hint">재생 데이터를 불러오는 중…</p></div>;
  }
  return <Replay key={round.id} round={round} track={track} meId={meId} room={room} />;
}

// 구슬 레이스 / 돌림판 / 사다리: 서버 시각 기준 재생 → 끝나면 결과
function Replay({ round, track, meId, room }) {
  // 라운드 행은 순번 진행·주기 재확인 때마다 새 객체로 오므로, 재생에 쓰는 값은 라운드 단위로 고정 (안 하면 재생이 리셋됨)
  const [names, meta] = useMemo(() => [round.players.map(p => p.name), round.meta], [round.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const startAt = new Date(round.start_at).getTime();
  const [ended, setEnded] = useState(() => serverNow() >= startAt + meta.durationMs);
  const g = round.game_type;
  const common = { meta, names, startAt, clock: serverNow, onEnd: () => setEnded(true) };
  const meIndex = round.players.findIndex(p => p.id === meId);

  return (
    <div className="stack">
      <p className="live-title">
        <span className="live-badge">🔴 LIVE</span> {gameLabel(g)}
        {g === 'marble' && ` · ${stageOf(meta)?.title}`}
      </p>
      {g === 'marble' && <MarbleStage {...common} track={track} final={round.opts?.final || 0} />}
      {g === 'wheel' && <WheelStage {...common} />}
      {g === 'ladder' && <LadderStage {...common} final={round.opts?.final || 0} meIndex={meIndex >= 0 ? meIndex : undefined} />}
      {ended && <ResultView round={round} meId={meId} room={room} />}
    </div>
  );
}

// 게임별 결과
export function ResultView({ round, meId, room, practice }) {
  if (round.game_type === 'reaction') return <ReactionResult round={round} meId={meId} room={room} />;
  if (round.game_type === 'wheel') return <WheelResult round={round} meId={meId} practice={practice} />;
  return <RankResult round={round} meId={meId} room={room} practice={practice} />;
}

function WheelResult({ round, meId, practice }) {
  const id = round.result?.[0];
  const p = round.players.find(x => x.id === id);
  return (
    <div className={`panel result wheel-win ${id === meId ? 'me' : ''}`}>
      <h3>{practice ? '연습 결과 (무효)' : '🎁 당첨'}</h3>
      <p className="big">🎉 {p?.name}</p>
    </div>
  );
}

// 순위 결과 (구슬 레이스·사다리): 1~(n-FINAL)위 = 자유 선택 순번, 나머지 = FINAL 진출. 순번 안내 중이면 현재 차례 강조
export function RankResult({ round, meId, room, practice }) {
  // FINAL 백업(반응속도 대신 구슬 레이스·사다리): 1~3위를 3위부터 공개하고 특별상품 표시
  if (round.opts?.prizes && !practice) {
    const at = new Date(round.start_at).getTime() + round.meta.durationMs;
    return <div className="stack"><p className="live-title">🏆 FINAL 결과</p><Podium round={round} room={room} meId={meId} at={at} /></div>;
  }
  const name = Object.fromEntries(round.players.map(p => [p.id, p.name]));
  const ids = round.result || [];
  const fin = round.opts?.final || 0;
  const picks = ids.slice(0, ids.length - fin);
  const finals = ids.slice(ids.length - fin);
  const turn = round.turn;
  const guiding = turn !== null && turn !== undefined;

  return (
    <div className="panel result">
      {guiding && (
        <div className="turn" aria-live="polite">
          {turn < picks.length ? (
            <>📢 지금 차례: <b>{name[picks[turn]]}</b>{picks[turn + 1] && <> → 다음: {name[picks[turn + 1]]}</>}</>
          ) : '✅ 자유 선택 상품 선택 완료'}
        </div>
      )}
      <h3>{practice ? '연습 결과 (무효)' : fin ? '🎁 자유 선택 상품 순번' : '🏁 최종 순위'}</h3>
      <ol className="ranks">
        {picks.map((id, i) => (
          <li key={id} className={`${id === meId ? 'me' : ''} ${guiding && i === turn ? 'cur' : ''} ${guiding && i < turn ? 'done' : ''}`}>
            <span className="rk">{i + 1}</span>{name[id]}
          </li>
        ))}
      </ol>
      {fin > 0 && (
        <>
          <h3>⚡ FINAL 진출</h3>
          <div className="finals">{finals.map(id => <span key={id} className={id === meId ? 'me' : ''}>{name[id]}</span>)}</div>
        </>
      )}
    </div>
  );
}

// 송출 종료 후: 직전 결과 화면을 그대로 유지 (재생이 끝난 라운드만), 아래에 경품/룰
function Waiting({ last, meId, room }) {
  return (
    <div className="stack">
      {last ? (
        <>
          <p className="live-badge off" style={{ fontSize: 15 }}>🔴 LIVE 대기중 · 직전 결과</p>
          <ResultView round={last} meId={meId} room={room} />
        </>
      ) : (
        <div className="live-wait">
          <p className="live-badge off">🔴 LIVE 대기중</p>
          <p className="hint">관리자가 송출을 시작하면 이 화면에서 바로 볼 수 있습니다.<br />다른 화면에 있으면 알림과 [LIVE 보기] 버튼이 나타납니다. 추첨 중에는 화면을 켜두세요.</p>
        </div>
      )}
      <section className="panel">
        <h3>🎁 특별상품 (FINAL)</h3>
        <ul className="prizes">
          {finalPrizes(room).map(([icon, rank, nm]) => <li key={rank}><span>{icon} {rank}</span>{nm}</li>)}
        </ul>
        <h3>🎁 자유 선택 상품</h3>
        <p className="hint">당첨 시 공개 (순위대로 선택)</p>
      </section>
      <section className="panel">
        <h3>📜 시상 룰</h3>
        <ul className="rules">{RULES.map(r => <li key={r}>{r}</li>)}</ul>
      </section>
    </div>
  );
}
