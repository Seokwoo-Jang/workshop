'use client';
// 👥 참가자 선택: 이름 탭 = 선택 ↔ 해제, 전체선택 / 전체해제, 선택 인원 실시간 표시
export default function PeoplePicker({ people, sel, setSel }) {
  const n = people.filter(p => sel.has(p.id)).length;
  const toggle = id => {
    const s = new Set(sel);
    s.has(id) ? s.delete(id) : s.add(id);
    setSel(s);
  };
  return (
    <div className="field">
      <div className="row" style={{ alignItems: 'center' }}>
        <label style={{ flex: 1 }}>👥 참가자 선택 ({n} / {people.length})</label>
        <button className="btn ghost small" onClick={() => setSel(new Set(people.map(p => p.id)))}>전체선택</button>
        <button className="btn ghost small" onClick={() => setSel(new Set())}>전체해제</button>
      </div>
      <div className="chips">
        {people.map(p => (
          <button key={p.id} className="chip" aria-pressed={sel.has(p.id)} onClick={() => toggle(p.id)}>
            {sel.has(p.id) ? '☑' : '☐'} {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
