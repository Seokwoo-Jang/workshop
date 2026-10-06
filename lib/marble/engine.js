// 🎱 구슬 레이스 — 화면 없이 끝까지 시뮬레이션하고 궤적을 기록한다 (관리자 기기 / 연습 모드).
// 물리·배치·정지 판정·스킬·슬로모션은 lazygyu/roulette (MIT, lib/marble/LICENSE) 로직을 planck.js로 옮긴 것.
// 각 폰은 기록만 재생하므로 기기별 물리 차이가 결과에 영향을 주지 않는다.
import { World, Vec2, Edge, Box, Circle } from 'planck';
import { stages } from './maps';
import { fadu } from './fadu';
import { rng } from '../rng';

// 0번 = FADU 자체 맵, 1번~ = lazygyu 원본 맵
export const STAGES = [fadu, ...stages];
export const MAPS = STAGES.map((s, i) => ({ index: i, title: s.title }));
// meta v1 (FADU 맵 추가 전 기록)은 원본 맵 번호 → 한 칸 밀림
export const stageOf = meta => STAGES[(meta?.v ?? 1) >= 2 ? meta.map : meta.map + 1];

const TICK = 10;              // ms, 원본 게임 루프와 같은 고정 스텝 (벽시계)
export const FRAME_TICKS = 3; // 3틱(30ms)마다 1프레임 기록 → 재생 시 보간
export const FRAME_MS = TICK * FRAME_TICKS;
const STUCK_DELAY = 5000;
export const ZOOM_THRESHOLD = 5;
const REMOVE_AFTER = 500;     // 골인 후 구슬 제거까지 (ms)
const TAIL = 1500;            // 결과 확정 후 여운 (ms)
const MAX_MS = 240000;        // 안전장치: 4분 넘으면 현재 위치 순으로 확정
const Q = 100;                // 좌표 int16 양자화 배율 (0.01 단위)

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length; i !== 0;) {
    const j = Math.floor(rand() * i--);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 원본 Marble 생성자의 출발 배치
export function spawnPos(order, n) {
  const maxLine = Math.ceil(n / 10);
  const lineDelta = -Math.max(0, Math.ceil(maxLine - 5));
  return { x: 10.25 + (order % 10) * 0.6, y: maxLine - Math.floor(order / 10) + lineDelta };
}

function buildStage(world, stage) {
  return (stage.entities || []).map(e => {
    const body = world.createBody({ type: e.type, position: new Vec2(e.position.x, e.position.y) });
    const fx = { density: e.props.density, restitution: e.props.restitution };
    const s = e.shape;
    if (s.type === 'polyline') {
      for (let i = 0; i < s.points.length - 1; i++) {
        body.createFixture(new Edge(new Vec2(...s.points[i]), new Vec2(...s.points[i + 1])), { density: 1 });
      }
    } else if (s.type === 'box') {
      body.createFixture(new Box(s.width, s.height, new Vec2(0, 0), s.rotation), fx);
    } else {
      body.createFixture(new Circle(s.radius), fx);
    }
    body.setAngularVelocity(e.props.angularVelocity);
    return { body, life: e.props.life ?? -1, alive: true };
  });
}

/**
 * names: 참가자 이름 배열 (index = 참가자 순서)
 * opts.map: 맵 번호, opts.cut: 이 등수까지 확정되면 종료 (나머지는 위치 순, 예: 19명 중 16)
 * opts.onProgress(0~1), opts.signal(AbortSignal: 연습 화면을 떠나면 중단). 이벤트 루프 양보는 내부에서 처리
 * 반환: { meta, data } — meta는 JSON, data는 base64 궤적
 */
export function simulate(names, seed, { map = 0, ...opts } = {}) {
  return simulateStage(STAGES[map], names, seed, { ...opts, map });
}

// 맵 객체를 직접 받는 버전 (맵 설계·테스트용). meta.map은 opts.map
export async function simulateStage(stage, names, seed, { map = 0, cut, onProgress, signal } = {}) {
  const rand = rng(seed);
  const n = names.length;
  const end = Math.min(Math.max(1, cut ?? n - 1), n - 1) - 1; // 슬로모션/카메라가 주목하는 등수 (0-based)
  const world = new World({ gravity: new Vec2(0, 10) });
  const entities = buildStage(world, stage);

  // 원본 setMarbles: 출발 순서 셔플, weight는 모두 같으므로 0.1
  const orders = shuffle([...Array(n).keys()], rand);
  const weight = 0.1;
  const maxCool = 1000 + (1 - weight) * 4000;
  const marbles = names.map((name, p) => {
    const order = orders.pop();
    const cool = maxCool * rand();
    const pos = spawnPos(order, n);
    const body = world.createBody({ type: 'dynamic', position: new Vec2(pos.x, pos.y) });
    body.createFixture(new Circle(0.25), { density: 1 + rand() });
    return { p, order, body, cool, stuck: 0, last: { x: pos.x, y: pos.y }, goal: false, removeAt: -1 };
  });

  const frames = [];  // [Int16Array(n*2)]
  const tPhys = [];   // 프레임별 물리 시각 (회전체 각도 = ω·t)
  const goals = [];   // [참가자, 프레임]
  const pops = [];    // [엔티티, 프레임] — 닿으면 사라지는 장애물
  const skills = [];  // [참가자, 프레임] — 충격파 연출
  let winners = 0, timeScale = 1, phys = 0, tick = 0, doneAt = -1;

  const record = () => {
    const f = new Int16Array(n * 2);
    marbles.forEach((m, i) => {
      const v = m.body ? m.body.getPosition() : m.last;
      f[i * 2] = Math.round(Math.max(-327, Math.min(327, v.x)) * Q);
      f[i * 2 + 1] = Math.round(Math.max(-327, Math.min(327, v.y)) * Q);
    });
    frames.push(f);
    tPhys.push(phys);
  };
  record();

  while (true) {
    const ms = tick * TICK;
    const fi = frames.length; // 이번 틱이 속할 프레임
    const ts = timeScale;
    world.step((TICK / 1000) * ts, 6, 2);
    phys += (TICK / 1000) * ts;

    for (const e of entities) {
      if (e.alive && e.life > 0) {
        for (let c = e.body.getContactList(); c; c = c.next) {
          if (c.contact.isTouching()) { world.destroyBody(e.body); e.alive = false; pops.push([entities.indexOf(e), fi]); break; }
        }
      }
    }

    for (const m of marbles) {
      if (m.removeAt >= 0 && ms >= m.removeAt && m.body) {
        const v = m.body.getPosition(); m.last = { x: v.x, y: v.y };
        world.destroyBody(m.body); m.body = null;
      }
    }

    // Marble.update + Roulette._updateMarbles
    const active = marbles.filter(m => !m.goal);
    const hit = [];
    for (const m of active) {
      const v = m.body.getPosition();
      const th = 0.00001 * ts * ts;
      if ((v.x - m.last.x) ** 2 + (v.y - m.last.y) ** 2 < th) {
        m.stuck += TICK;
        if (m.stuck > STUCK_DELAY) {
          m.body.applyLinearImpulse(new Vec2(rand() * 10 - 5, rand() * 10 - 5), m.body.getWorldCenter(), true);
          m.stuck = 0;
        }
      } else m.stuck = 0;
      m.last = { x: v.x, y: v.y };

      m.cool -= TICK;
      if (m.cool <= 0) {
        m.cool = maxCool;
        if (rand() < 0.2 * weight) { // 충격파: 반경 10 안의 구슬을 밀어냄 (원본 impact 그대로)
          skills.push([m.p, fi]);
          for (const o of marbles) {
            if (o === m || !o.body) continue;
            const d = Vec2.sub(o.body.getPosition(), v);
            if (d.lengthSquared() < 100) {
              d.normalize();
              const power = 1 - d.length() / 10;
              o.body.applyLinearImpulse(Vec2.mul(d, power * power * 5), o.body.getWorldCenter(), true);
            }
          }
        }
      }

      if (v.y > stage.goalY) hit.push(m);
    }
    // 같은 틱에 들어온 구슬은 더 깊이 들어간 순 (참가자 목록 순서가 순위에 영향 주지 않게)
    hit.sort((a, b) => b.body.getPosition().y - a.body.getPosition().y);
    for (const m of hit) {
      m.goal = true;
      m.removeAt = ms + REMOVE_AFTER;
      goals.push([m.p, fi]);
      winners++;
    }

    // 슬로모션: 커트라인 등수에 걸친 구슬이 골에 가까우면 느리게 (원본 _calcTimeScale)
    const rest = marbles.filter(m => !m.goal).sort((a, b) => b.body.getPosition().y - a.body.getPosition().y);
    const target = end - winners;
    timeScale = 1;
    if (rest[target] && winners < end + 1) {
      const y = rest[target].body.getPosition().y;
      const dist = Math.abs(stage.zoomY - y);
      if (dist < ZOOM_THRESHOLD && y > stage.zoomY - ZOOM_THRESHOLD * 1.2 && (rest[target - 1] || rest[target + 1])) {
        timeScale = Math.max(0.2, dist / ZOOM_THRESHOLD);
      }
    }

    tick++;
    if (tick % FRAME_TICKS === 0) record();

    const decided = winners >= end + 1 || rest.length <= 1;
    if (doneAt < 0 && (decided || ms >= MAX_MS)) doneAt = ms;
    if (doneAt >= 0 && ms >= doneAt + TAIL && tick % FRAME_TICKS === 0) break;

    if (tick % 500 === 0) {
      onProgress?.(Math.min(0.99, winners / (end + 1)));
      await new Promise(r => setTimeout(r, 0));
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    }
  }

  // 최종 순위: 골인 순 → 남은 구슬은 골에 가까운 순
  const arrived = goals.map(g => g[0]);
  const left = marbles.filter(m => !m.goal)
    .sort((a, b) => (b.body?.getPosition().y ?? b.last.y) - (a.body?.getPosition().y ?? a.last.y))
    .map(m => m.p);
  const ranking = [...arrived, ...left];

  onProgress?.(1);
  const meta = {
    v: 2, map, n, cut: end + 1, frames: frames.length, frameMs: FRAME_MS,
    durationMs: frames.length * FRAME_MS, decidedMs: doneAt,
    orders: marbles.map(m => m.order), goals, pops, skills, ranking,
  };
  return { meta, data: encode(frames, tPhys, n) };
}

// ───────────────────────── 궤적 직렬화: [Float32 물리시각 × F][Int16 (x,y) × n × F] → base64
function encode(frames, tPhys, n) {
  const F = frames.length;
  const buf = new ArrayBuffer(F * 4 + F * n * 4);
  new Float32Array(buf, 0, F).set(tPhys);
  const pos = new Int16Array(buf, F * 4, F * n * 2);
  frames.forEach((f, i) => pos.set(f, i * n * 2));
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function decode(data, meta) {
  const bin = atob(data);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const F = meta.frames, n = meta.n;
  return {
    tPhys: new Float32Array(u8.buffer, 0, F),
    pos: new Int16Array(u8.buffer, F * 4, F * n * 2),
  };
}

// 재생용: 시각 ms에서 구슬 i의 위치 (프레임 보간)
export function marbleAt(track, meta, i, ms) {
  const f = Math.max(0, Math.min(meta.frames - 1, ms / meta.frameMs));
  const a = Math.floor(f), b = Math.min(meta.frames - 1, a + 1), k = f - a;
  const n = meta.n, p = track.pos;
  return {
    x: (p[(a * n + i) * 2] * (1 - k) + p[(b * n + i) * 2] * k) / Q,
    y: (p[(a * n + i) * 2 + 1] * (1 - k) + p[(b * n + i) * 2 + 1] * k) / Q,
  };
}

export function physAt(track, meta, ms) {
  const f = Math.max(0, Math.min(meta.frames - 1, ms / meta.frameMs));
  const a = Math.floor(f), b = Math.min(meta.frames - 1, a + 1), k = f - a;
  return track.tPhys[a] * (1 - k) + track.tPhys[b] * k;
}
