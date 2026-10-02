'use client';
import { SHOOT_LAST, SHOOT_PRIZES } from '@/lib/prizes';
import { shootBoard } from '@/lib/shoot';

// 🎯 사격 순위 (참가자는 관람만, 점수는 관리자 패널에서 입력). 순위만 보여주고 게임과 연동하지 않음
export default function ShootTab({ sess, room, people, scores }) {
  const { rows, unscored } = shootBoard(people, scores);

  return (
    <div className="stack">
      <div>
        <h2>사격 순위</h2>
        <p className="sub">클레이사격 · 점수는 관리자가 입력합니다</p>
      </div>

      <section className="panel">
        <h3>🎁 사격 경품</h3>
        <ul className="prizes">
          {SHOOT_PRIZES.map(([icon, rank, nm], i) => (
            <li key={rank}>
              <span>{icon} {rank}</span>
              <span>{nm}{i === 0 && room.shoot_pick && <b className="pick"> → {room.shoot_pick} 선택</b>}</span>
            </li>
          ))}
          <li><span>💩 꼴찌</span><span>{SHOOT_LAST}</span></li>
        </ul>
      </section>

      {rows.length === 0 ? (
        <p className="empty-note">아직 기록이 없습니다</p>
      ) : (
        <ol className="board">
          {rows.map(r => (
            <li key={r.user_id} className={`${r.user_id === sess.participant_id ? 'me' : ''} ${r.medal ? 'medal' : ''}`}>
              <span className="rk">{r.medal || r.rank}</span>
              <span className="nm">
                {r.tied && <small className="tie">공동 {r.rank}위</small>}
                {r.name}{r.poop && ' 💩'}
              </span>
              <span className="sc">{r.score}<small>점</small>{r.tiebreak !== null && <small className="tb"> 2차전 {r.tiebreak}</small>}</span>
            </li>
          ))}
        </ol>
      )}
      {unscored.length > 0 && rows.length > 0 && <p className="hint">미기록 {unscored.length}명</p>}
    </div>
  );
}
