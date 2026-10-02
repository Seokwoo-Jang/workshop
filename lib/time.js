import { useEffect, useState } from 'react';
import { rpc } from './supabase';

// 서버 시각 기준 시계. 휴대폰 시간은 쓰지 않는다.
let offset = 0;

// 3회 측정해 RTT가 가장 짧은 값 사용. 실패하면 2·4·8…초 뒤 재시도 (복귀 시에도 다시 호출)
let retry;
export async function syncClock(wait = 2000) {
  clearTimeout(retry);
  try {
    let best = null;
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      const s = await rpc('server_now');
      const t1 = Date.now();
      if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, off: new Date(s).getTime() - (t0 + t1) / 2 };
    }
    offset = best.off;
  } catch {
    retry = setTimeout(() => syncClock(Math.min(wait * 2, 30000)), wait);
  }
}

export const serverNow = () => Date.now() + offset;

export function useNow(ms = 1000) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const KST = 9 * 3600 * 1000;
const kst = ms => new Date(ms + KST).toISOString(); // 'YYYY-MM-DDTHH:MM:SS.sssZ' in KST digits

export const kstHHMM = ms => kst(ms).slice(11, 16);

export function fmtOpen(iso) {
  const s = kst(new Date(iso).getTime());
  return `${+s.slice(5, 7)}/${+s.slice(8, 10)} ${s.slice(11, 16)}`;
}

// <input type="datetime-local"> 값 <-> ISO (KST 고정)
export const toInputKST = iso => (iso ? kst(new Date(iso).getTime()).slice(0, 16) : '');
export const fromInputKST = v => (v ? new Date(`${v}:00+09:00`).toISOString() : null);

export function countdown(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const p = n => String(n).padStart(2, '0');
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
}
