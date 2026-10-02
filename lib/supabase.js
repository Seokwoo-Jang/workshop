import { createClient } from '@supabase/supabase-js';

// 키: Supabase Connect 창(Next.js)이 주는 이름(PUBLISHABLE_KEY)과 예전 이름(ANON_KEY) 둘 다 받음
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MSG = {
  NOT_OPEN: '아직 예약 오픈 전입니다',
  TAKEN: '이미 예약된 좌석입니다',
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다. 방 번호를 확인하세요',
  BAD_NAME: '이름은 1~20자로 입력하세요',
  BAD_PIN: 'PIN은 숫자 4~8자리입니다',
  NOT_JOINED: '입장 정보가 만료됐습니다. 다시 입장하세요',
  NOT_ADMIN: '관리자 세션이 만료됐습니다. 관리자 모드에서 PIN을 다시 입력하세요',
  PIN_LOCKED: 'PIN을 5회 틀렸습니다. 1분 후 다시 시도하세요',
  BAD_TIME: '시간은 HH:MM 형식으로 입력하세요',
  BAD_TITLE: '일정 제목을 입력하세요',
  BAD_URL: 'http:// 또는 https://로 시작하는 주소를 입력하세요',
  BAD_USER: '해당 참가자를 찾을 수 없습니다',
  STALE: '좌석 상태가 방금 바뀌었습니다. 다시 확인하세요',
  PAST_TIME: '새 오픈 시각은 지금 이후로 설정하세요 (비워두면 예약 닫힘)',
  BAD_GAME: '아직 준비되지 않은 게임입니다',
  FEW_PLAYERS: '참가자를 2명 이상 선택하세요',
  ROUND_GONE: '이미 시작됐거나 취소된 라운드입니다',
  BAD_RESULT: '결과 데이터가 올바르지 않습니다',
  TOO_BIG: '재생 데이터가 너무 큽니다. 다른 맵을 선택하세요',
  MANY_PLAYERS: '반응속도는 최대 8명까지 가능합니다',
  NOT_YOUR_TURN: '지금은 내 차례가 아닙니다',
  STALE_TRIAL: '이미 끝난 판입니다. 화면을 새로 고칩니다',
  BAD_SCORE: '점수는 0~999 사이 숫자로 입력하세요',
  BAD_PICK: '가민 또는 애플워치 중에서 고르세요',
  BAD_ACTION: '지원하지 않는 동작입니다',
  CHANGED: '진행 상태가 방금 바뀌었습니다. 화면을 확인하고 다시 누르세요',
};

const CODES = Object.keys(MSG).sort((a, b) => b.length - a.length);

export class RpcError extends Error {
  constructor(code) {
    super(MSG[code] || '요청을 처리하지 못했습니다. 네트워크 연결을 확인하고 다시 시도하세요');
    this.code = code;
  }
}

export async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    // 긴 코드부터 비교 ('STALE_TRIAL'이 'STALE'로 잡히지 않게)
    const code = CODES.find(k => error.message?.includes(k)) || 'UNKNOWN';
    if (code === 'NOT_JOINED') window.dispatchEvent(new Event('ws-expired')); // page.js가 세션 재확인
    throw new RpcError(code);
  }
  return data;
}
