'use client';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/lib/ui';

export default function Invite() {
  const url = `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했습니다'); }
    catch { toast('복사하지 못했습니다. 링크를 길게 눌러 복사하세요'); }
  };
  return (
    <div className="stack">
      <div className="qr"><QRCodeSVG value={url} size={200} marginSize={2} /></div>
      <p className="hint" style={{ textAlign: 'center', wordBreak: 'break-all' }}>{url}</p>
      <button className="btn ghost" onClick={copy}>초대 링크 복사</button>
    </div>
  );
}
