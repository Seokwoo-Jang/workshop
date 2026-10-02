'use client';
import { useEffect, useState } from 'react';

export default function Toaster() {
  const [m, setM] = useState(null);
  useEffect(() => {
    let t;
    const on = e => { setM(e.detail); clearTimeout(t); t = setTimeout(() => setM(null), 2400); };
    window.addEventListener('ws-toast', on);
    return () => { window.removeEventListener('ws-toast', on); clearTimeout(t); };
  }, []);
  return m ? <div className="toast" role="status">{m}</div> : null;
}
