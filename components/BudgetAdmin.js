'use client';
import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';

// 💰 예산 (관리자 전용). 공개 테이블이 아니라 관리자 RPC로만 읽고 씀 → 참가자 화면·공개 API에 금액 노출 없음
// 구분별 묶음 + 소계, 총예산(고정) 대비 실제 지출·잔액, 예비비 예산은 자동. 항목을 누르면 아래 폼에서 수정
const won = v => (v === null || v === undefined ? '-' : Number(v).toLocaleString('ko-KR'));
const digits = s => s.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 11);
const num = s => (s === '' ? null : Number(s));
const str = v => (v === null || v === undefined ? '' : String(v));
const sum = (a, k) => a.reduce((t, x) => t + (x[k] ?? 0), 0);
const subtotal = (a, k) => (a.some(x => x[k] !== null) ? won(sum(a, k)) : '-'); // 입력된 금액이 없으면 '-'
const BLANK = { id: null, category: '', name: '', planned: '', basis: '', actual: '', paid: false };
const RESERVE = '예비비'; // 이 구분의 첫 항목은 예산 자동 계산

export default function BudgetAdmin({ A, run, ask }) {
  const [data, setData] = useState(null); // { total, items } | 'error'
  const [f, setF] = useState(BLANK);

  const load = useCallback(() => rpc('admin_budget', { p_admin: A }).then(setData, () => setData(d => d || 'error')), [A]);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // 다른 관리자 기기에서 고친 내용
    return () => clearInterval(id);
  }, [load]);

  if (data === null) return <section className="panel"><h3>💰 예산</h3><p className="hint">불러오는 중…</p></section>;
  if (data === 'error') {
    return (
      <section className="panel">
        <h3>💰 예산</h3>
        <p className="hint">예산 표를 불러오지 못했습니다 (DB에 예산 기능이 아직 없거나 네트워크 문제).</p>
        <button className="btn ghost small" onClick={load}>다시 불러오기</button>
      </section>
    );
  }

  // 총예산은 고정(DB 값), 예비비 예산 = 총예산 − 다른 항목 예산 합계 (첫 '예비비' 구분 항목, 직접 입력 안 함)
  const reserve = data.items.find(x => x.category === RESERVE);
  const others = sum(data.items.filter(x => x !== reserve), 'planned');
  const auto = data.total === null ? null : data.total - others;
  const items = data.items.map(x => (x === reserve ? { ...x, planned: auto, auto: true } : x));
  const planned = sum(items, 'planned'), actual = sum(items, 'actual');
  const left = data.total === null ? null : data.total - actual;
  const groups = [...new Set(items.map(x => x.category))].map(c => ({ c, rows: items.filter(x => x.category === c) }));
  const editingReserve = !!reserve && f.id === reserve.id && f.category.trim() === RESERVE; // 구분을 바꾸면 일반 항목으로
  const set = k => e => setF({ ...f, [k]: k === 'planned' || k === 'actual' ? digits(e.target.value) : e.target.value });
  const save = (fn, msg) => run(async () => { try { await fn(); } finally { await load(); } }, msg, []); // 실패(삭제된 항목 등)해도 표는 최신으로

  const saveItem = () => save(async () => {
    await rpc('admin_budget_upsert', {
      p_admin: A, p_id: f.id, p_category: f.category, p_name: f.name, p_planned: editingReserve ? null : num(f.planned),
      p_basis: f.basis, p_actual: num(f.actual), p_paid: f.paid,
    });
    setF(BLANK);
  }, f.id ? '항목을 수정했습니다' : '항목을 추가했습니다');

  const togglePaid = x => save(() => rpc('admin_budget_upsert', {
    p_admin: A, p_id: x.id, p_category: x.category, p_name: x.name, p_planned: x.auto ? null : x.planned,
    p_basis: x.basis, p_actual: x.actual, p_paid: !x.paid,
  }), null);

  const del = async () => {
    if (!(await ask(`'${f.name}' 항목을 삭제하시겠습니까?`, '삭제', true))) return;
    save(async () => { await rpc('admin_budget_delete', { p_admin: A, p_id: f.id }); setF(BLANK); }, '항목을 삭제했습니다');
  };

  const edit = x => setF({ ...x, planned: str(x.auto && x.planned < 0 ? null : x.planned), actual: str(x.actual) });

  return (
    <section className="panel">
      <h3>💰 예산 <span className="badge">관리자만</span></h3>

      <div className="budget-sum">
        <div><span>총예산 (고정)</span><b>{won(data.total)}</b></div>
        <div><span>실제 지출</span><b>{won(actual)}</b></div>
        <div className={left !== null && left < 0 ? 'over' : ''}><span>잔액</span><b>{won(left)}</b></div>
      </div>
      {reserve && auto !== null && auto < 0 && (
        <p className="notice">예비비가 부족합니다 · 다른 항목 예산 합계가 총예산보다 {won(-auto)}원 많음</p>
      )}
      {!reserve && data.total !== null && planned !== data.total && (
        <p className="notice">예산 합계 {won(planned)}원 · 총예산과 {won(Math.abs(data.total - planned))}원 {planned > data.total ? '초과' : '차이'}</p>
      )}

      <table className="budget-table">
        <thead>
          <tr><th>항목</th><th>예산</th><th>실제</th><th aria-label="결제 완료">결제</th></tr>
        </thead>
        <tbody>
          {groups.map(({ c, rows }) => [
            <tr key={`h${c}`} className="budget-cat">
              <td>{c || '기타'}</td><td>{subtotal(rows, 'planned')}</td><td>{subtotal(rows, 'actual')}</td><td />
            </tr>,
            ...rows.map(x => (
              <tr key={x.id} className={f.id === x.id ? 'on' : ''}>
                <td>
                  <button className="budget-name" onClick={() => edit(x)}>{x.name}</button>
                  {x.basis && <small>{x.basis}</small>}
                </td>
                <td className={x.auto && x.planned < 0 ? 'over' : ''}>{won(x.planned)}{x.auto && <small>자동</small>}</td>
                <td className={x.actual !== null && x.planned !== null && x.actual > x.planned ? 'over' : ''}>{won(x.actual)}</td>
                <td>
                  <input type="checkbox" checked={x.paid} onChange={() => togglePaid(x)} aria-label={`${x.name} 결제 완료`} />
                </td>
              </tr>
            )),
          ])}
        </tbody>
        <tfoot>
          <tr><td>합계</td><td>{subtotal(items, 'planned')}</td><td>{subtotal(items, 'actual')}</td><td>{items.filter(x => x.paid).length}/{items.length}</td></tr>
        </tfoot>
      </table>
      <p className="hint">단위: 원 · 예비비 예산 = 총예산 − 다른 항목 예산 (자동) · 항목 이름을 누르면 아래에서 수정 · 실제 지출이 예산을 넘으면 빨간색</p>

      <div className="stack">
        <p className="hint" style={{ fontWeight: 700 }}>{f.id ? `'${f.name}' 수정` : '항목 추가'}</p>
        <div className="row">
          <input className="input" placeholder="구분 (예: 식대)" value={f.category} onChange={set('category')} aria-label="구분" maxLength={20} style={{ flex: 1 }} />
          <input className="input" placeholder="항목" value={f.name} onChange={set('name')} aria-label="항목" maxLength={40} style={{ flex: 2 }} />
        </div>
        <div className="row">
          {editingReserve
            ? <input className="input" value={`${won(auto)} (자동)`} disabled aria-label="예산 (자동 계산)" />
            : <input className="input" inputMode="numeric" placeholder="예산 (원)" value={f.planned} onChange={set('planned')} aria-label="예산 (원)" />}
          <input className="input" inputMode="numeric" placeholder="실제 지출 (원)" value={f.actual} onChange={set('actual')} aria-label="실제 지출 (원)" />
        </div>
        <input className="input" placeholder="산출 근거 (예: 23명 × 15,000원)" value={f.basis} onChange={set('basis')} aria-label="산출 근거" maxLength={100} />
        <label className="check">
          <input type="checkbox" checked={f.paid} onChange={e => setF({ ...f, paid: e.target.checked })} />
          <span>결제 완료</span>
        </label>
        <div className="row">
          {f.id && <button className="btn ghost" onClick={() => setF(BLANK)}>취소</button>}
          {f.id && <button className="btn danger" onClick={del}>삭제</button>}
          <button className="btn primary" disabled={!f.name.trim()} onClick={saveItem}>{f.id ? '수정 저장' : '항목 추가'}</button>
        </div>
      </div>
    </section>
  );
}
