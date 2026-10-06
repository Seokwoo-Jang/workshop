// 🎱 구슬 레이스 재생 렌더러 (canvas). 기록된 궤적만 그린다 — 물리 없음.
// 카메라·엔티티·구슬 그리기는 lazygyu/roulette (MIT, lib/marble/LICENSE) camera.ts / rouletteRenderer.ts 기준, 세로 화면용으로 조정.
import { ZOOM_THRESHOLD, marbleAt, physAt, spawnPos, stageOf } from './engine';

const VIEW_W = 20; // 줌 1일 때 화면 가로에 보이는 맵 폭
const THEME = {    // 원본 dark 테마 (bloom은 모바일 성능 때문에 생략)
  bg: '#000',
  box: { fill: 'cyan', line: 'cyan' },
  circle: { fill: 'yellow', line: 'yellow' },
  polyline: { fill: 'white', line: 'white' },
  skill: 'white',
  win: 'white',
};

export function createView(canvas, { meta, track, names }) {
  const stage = stageOf(meta);
  const ctx = canvas.getContext('2d', { alpha: false });
  const n = meta.n;
  const hue = i => (360 / n) * meta.orders[i];
  const goalFrame = new Map(meta.goals.map(([p, f]) => [p, f]));
  const popFrame = new Map(meta.pops.map(([e, f]) => [e, f]));
  const cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };
  let lastMs = -1;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h };
  };

  // 출발 전: 출발 지점을 확대 (원본 setMarbles 카메라)
  const home = ({ w, h }) => {
    const cols = Math.min(n, 10), rows = Math.ceil(n / 10);
    const lineDelta = -Math.max(0, Math.ceil(rows - 5));
    const viewH = (VIEW_W * h) / w;
    const z = Math.max(1, Math.min(VIEW_W / (Math.max((cols - 1) * 0.6, 1) + 6), viewH / (Math.max(rows - 1, 1) + 6), 3));
    return { x: 10.25 + (cols - 1) * 0.3, y: (1 + rows) / 2 + lineDelta, zoom: z };
  };

  const ease = (cur, to, d) => (Math.abs(to - cur) < 1 / 30 ? to : cur + (to - cur) / d);

  function draw(ms) {
    const { w, h } = size();
    const playing = ms >= 0;
    const t = Math.max(0, ms);
    const f = t / meta.frameMs;
    const pos = names.map((_, i) => marbleAt(track, meta, i, t));
    const arrived = meta.goals.filter(([, gf]) => gf <= f).length;
    const racing = names.map((_, i) => i).filter(i => !(goalFrame.get(i) <= f)).sort((a, b) => pos[b].y - pos[a].y);

    // 카메라 (원본 Camera.update)
    if (!playing) {
      const hm = home({ w, h });
      Object.assign(cam, { x: hm.x, y: hm.y, zoom: hm.zoom, tx: hm.x, ty: hm.y, tz: hm.zoom });
    } else {
      const end = meta.cut - 1;
      const ti = arrived > 0 ? end - arrived : 0;
      const tm = racing[ti] ?? racing[0];
      if (tm !== undefined) {
        cam.tx = pos[tm].x; cam.ty = pos[tm].y;
        const zt = racing[end - arrived];
        const near = zt !== undefined && Math.abs(stage.zoomY - pos[zt].y) < ZOOM_THRESHOLD;
        cam.tz = near ? Math.max(1, (1 - Math.abs(stage.zoomY - cam.y) / ZOOM_THRESHOLD) * 4) : 1;
      } else cam.tz = 1;
      const jump = lastMs < 0 || Math.abs(ms - lastMs) > 1000; // 중간 접속/seek이면 바로 이동
      cam.x = jump ? cam.tx : ease(cam.x, cam.tx, 20);
      cam.y = jump ? cam.ty : ease(cam.y, cam.ty, 10);
      cam.zoom = jump ? cam.tz : ease(cam.zoom, cam.tz, 10);
    }
    lastMs = playing ? ms : -1;

    const S = (w / VIEW_W) * cam.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(S, 0, 0, S, w / 2 - cam.x * S, h / 2 - cam.y * S);
    ctx.lineWidth = 2.5 / S + 0.04;

    // 엔티티: 회전체 각도 = ω × 물리시각, 닿으면 사라지는 장애물은 기록된 프레임 이후 숨김
    const tp = physAt(track, meta, t);
    stage.entities.forEach((e, k) => {
      if (popFrame.has(k) && popFrame.get(k) <= f) return;
      const s = e.shape;
      ctx.save();
      ctx.translate(e.position.x, e.position.y);
      if (e.type === 'kinematic') ctx.rotate(e.props.angularVelocity * tp);
      ctx.fillStyle = s.color ?? THEME[s.type].fill;
      ctx.strokeStyle = s.color ?? THEME[s.type].line;
      if (s.type === 'polyline') {
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      } else if (s.type === 'box') {
        ctx.rotate(s.rotation);
        ctx.fillRect(-s.width, -s.height, s.width * 2, s.height * 2);
        ctx.strokeRect(-s.width, -s.height, s.width * 2, s.height * 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
        if (s.color) ctx.fill(); // 색 지정 원(FADU 글자 점)은 채워서 또렷하게
        ctx.stroke();
      }
      ctx.restore();
    });

    // 충격파 연출 (0.5초)
    meta.skills.forEach(([p, sf]) => {
      const age = (f - sf) * meta.frameMs;
      if (age < 0 || age > 500) return;
      const at = marbleAt(track, meta, p, sf * meta.frameMs);
      ctx.save();
      ctx.globalAlpha = 1 - (age / 500) ** 2;
      ctx.strokeStyle = THEME.skill;
      ctx.lineWidth = 1 / S;
      ctx.beginPath();
      ctx.arc(at.x, at.y, (age / 500) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // 구슬 + 이름. 골인 0.5초 뒤 제거 (원본과 같음)
    const focus = playing ? racing[meta.cut - 1 - arrived] : undefined;
    const fontPx = 11 * Math.min(2, window.devicePixelRatio || 1);
    names.forEach((name, i) => {
      const gf = goalFrame.get(i);
      if (gf !== undefined && (f - gf) * meta.frameMs > 500) return;
      const p = playing ? pos[i] : spawnPos(meta.orders[i], n);
      ctx.fillStyle = `hsl(${hue(i)} 100% 75%)`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 0.25, 0, Math.PI * 2);
      ctx.fill();
      if (i === focus) {
        ctx.strokeStyle = THEME.win;
        ctx.lineWidth = 2 / S;
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(p.x, p.y + 0.3);
      ctx.scale(1 / S, 1 / S);
      ctx.font = `700 ${fontPx}px Pretendard Variable, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = `hsl(${hue(i)} 100% 75%)`;
      ctx.strokeText(name, 0, 0);
      ctx.fillText(name, 0, 0);
      ctx.restore();
    });

    return arrived;
  }

  return { draw };
}
