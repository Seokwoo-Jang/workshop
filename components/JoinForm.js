'use client';
import { useState } from 'react';
import { rpc } from '@/lib/supabase';
import { ROOM, deviceId, setSession } from '@/lib/session';
import { asset, useConfirm } from '@/lib/ui';

export default function JoinForm({ onJoined }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialog, ask] = useConfirm();

  const join = async (force = false) => {
    const r = await rpc('join_room', { p_code: ROOM, p_name: name, p_device: deviceId(), p_force: force });
    if (r.status === 'confirm') {
      const n = name.trim();
      const yes = await ask(`'${n}' 이름이 다른 기기에서 이미 입장해 있습니다.\n본인이면 이 기기로 다시 연결합니다. 기존 좌석은 그대로 유지됩니다.\n\n본인이 아니면 취소하고 다른 이름(예: ${n}2)을 입력하세요.`, '본인 맞음, 연결');
      return yes ? join(true) : null;
    }
    return r;
  };

  const submit = async e => {
    e?.preventDefault();
    setErr('');
    if (!name.trim()) return setErr('이름을 입력하세요');
    setBusy(true);
    try {
      const r = await join();
      if (r) {
        const s = { participant_id: r.participant_id, name: r.name, token: r.token };
        onJoined(setSession(s));
        return;
      }
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  return (
    <div className="wrap land">
      <h1 className="land-title">
        <img className="brand" src={asset('/fadu-logo.png')} alt="FADU" width={159} height={28} />
        2026<br />IP TEAM<br />WORKSHOP<small>이름을 입력하고 입장하세요</small>
      </h1>
      <div className="stack">
        <div className="field">
          <label htmlFor="nm">이름</label>
          <input id="nm" className="input" maxLength={20} value={name} autoComplete="name"
            onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit(e)} />
          <p className="hint">다시 접속할 때도 같은 이름을 입력하면 기존 좌석과 기록이 이어집니다</p>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? '입장 중…' : '입장하기'}</button>
      </div>
      {dialog}
    </div>
  );
}
