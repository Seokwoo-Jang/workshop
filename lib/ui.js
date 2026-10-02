import { useCallback, useEffect, useState } from 'react';

// public/ 정적 파일 경로 (GitHub Pages basePath 포함)
export const asset = p => `${process.env.NEXT_PUBLIC_BASE_PATH || ''}${p}`;

// 전역 토스트
export const toast = m => window.dispatchEvent(new CustomEvent('ws-toast', { detail: m }));

// 추첨 재생 중 화면 꺼짐 방지 (미지원 기기는 무시). 앱 전환 후 복귀하면 다시 요청
export function useWakeLock(on) {
  useEffect(() => {
    if (!on || !navigator.wakeLock) return;
    let lock = null, dead = false;
    const req = () => document.visibilityState === 'visible' &&
      navigator.wakeLock.request('screen').then(l => (dead ? l.release() : (lock = l))).catch(() => {});
    req();
    document.addEventListener('visibilitychange', req);
    return () => { dead = true; document.removeEventListener('visibilitychange', req); lock?.release().catch(() => {}); };
  }, [on]);
}

// const [dialog, ask] = useConfirm();  if (await ask('메시지', '확인')) ...
export function useConfirm() {
  const [st, setSt] = useState(null);
  const ask = useCallback((message, ok = '확인', danger = false) =>
    new Promise(resolve => setSt({ message, ok, danger, resolve })), []);
  const close = v => { st?.resolve(v); setSt(null); };
  const dialog = st && (
    <div className="scrim" onClick={() => close(false)}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <p className="sheet-msg">{st.message}</p>
        <div className="row">
          <button className="btn ghost" onClick={() => close(false)}>취소</button>
          <button className={`btn ${st.danger ? 'danger' : 'primary'}`} autoFocus onClick={() => close(true)}>{st.ok}</button>
        </div>
      </div>
    </div>
  );
  return [dialog, ask];
}
