'use client';
import { useState } from 'react';
import { rpc } from '@/lib/supabase';

export default function AdminPin({ sess, onOk, onClose }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || pin.length < 4) return; // Enter 연타로 실패 카운트가 쌓이지 않게
    setErr(''); setBusy(true);
    try {
      const r = await rpc('admin_login', { p_token: sess.token, p_pin: pin });
      if (r.status === 'ok') return onOk(r.admin_token);
      setErr(r.status === 'locked' ? 'PIN을 5회 틀렸습니다. 1분 후 다시 시도하세요' : 'PIN이 맞지 않습니다');
      setPin('');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <p className="sheet-msg">관리자 PIN을 입력하세요</p>
        <input className="input" type="password" inputMode="numeric" autoFocus maxLength={8}
          value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && submit()} />
        {err && <p className="err">{err}</p>}
        <div className="row">
          <button className="btn ghost" onClick={onClose}>취소</button>
          <button className="btn primary" disabled={busy || pin.length < 4} onClick={submit}>관리자 모드 켜기</button>
        </div>
      </div>
    </div>
  );
}
