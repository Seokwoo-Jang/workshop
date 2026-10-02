// 기기 로컬 저장: 세션 + 기기 ID. 방은 1개(MAIN).
export const ROOM = 'MAIN';
const K = 'ws.session';

export function deviceId() {
  let id = localStorage.getItem('ws.device');
  if (!id) {
    // randomUUID는 https/localhost에서만 존재 → LAN http(폰 테스트)용 대체
    id = crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('ws.device', id);
  }
  return id;
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(K)) || null; } catch { return null; }
}

export function setSession(s) {
  Object.keys(s).forEach(k => s[k] === undefined && delete s[k]);
  localStorage.setItem(K, JSON.stringify(s));
  return s;
}

export const patchSession = patch => setSession({ ...(getSession() || {}), ...patch });
export const clearSession = () => localStorage.removeItem(K);
