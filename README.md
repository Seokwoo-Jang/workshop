# 2026 IP TEAM WORKSHOP

이름 입력 입장 · 버스 좌석 예약 · 🎯 사격 순위 · 일정 · 사진 링크 · 관리자 모드(PIN).
🎮 게임 (🔴 LIVE 송출 / 🕹 연습): 🎱 구슬 레이스 · ⚡ 반응속도 FINAL · 🎡 돌림판 · 🪜 사다리타기 · 📢 선택 순번 안내.
방은 1개.

스택: Next.js 16 정적 export (JS) + Supabase (Postgres, Realtime, RPC) + planck.js (구슬 물리). 별도 서버 없음.

## 1. Supabase

1. supabase.com → New project (Region: Northeast Asia (Seoul))
2. 관리자 PIN은 schema.sql SEED에 설정됨 (값은 schema.sql 참고). **supabase 폴더는 GitHub에 올리지 말 것** (PIN 노출, `.gitignore`에 포함)
3. SQL Editor → schema.sql 전체 붙여넣고 Run
4. 프로젝트 화면 맨 위 **Connect** → Next.js 선택 → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 두 줄 복사
   (또는 Project Settings → API Keys 의 Publishable key / legacy anon key. **secret·service_role 키는 절대 쓰지 말 것**)

PIN 변경은 SQL Editor에서:
```sql
update room_secrets set pin_hash = extensions.crypt('새PIN', extensions.gen_salt('bf')) where code = 'MAIN';
```

## 2. GitHub Pages 배포

1. GitHub 저장소 생성 → 이 폴더 내용 업로드 (`package.json`, `.github/`가 최상단에 오도록)
   - `.github` 폴더는 숨김 폴더라 드래그 업로드 시 빠질 수 있음. 빠졌으면 저장소에서 **Add file → Create new file** → 이름에 `.github/workflows/deploy.yml` 입력 후 내용 붙여넣기
2. Supabase URL·publishable key는 `.env.production`에 들어 있음 (공개용 값이라 커밋, GitHub Secrets 불필요)
   - 다른 Supabase 프로젝트로 바꾸면 이 파일의 두 줄만 수정
3. **Settings → Pages → Source: GitHub Actions**
4. **Actions** 탭 → `Deploy to GitHub Pages` → **Run workflow** (이후엔 push할 때마다 자동)
5. 완료 후 `https://아이디.github.io/저장소명/` 접속

빌드 실패 시 Actions 탭 → 실패한 실행 → 빨간 단계 로그 확인.

## 로컬 실행 (수정 확인용)

```bash
cp .env.example .env.local   # Connect 창의 URL·publishable key 두 줄로 교체 (BASE_PATH는 비워둠)
npm install
npm run dev                  # http://localhost:3000
```

폰은 같은 Wi-Fi에서 `http://<PC IP>:3000` 접속.

## 사용 흐름

- 참가자: 초대 QR(사이트 주소) → 이름 입력 → 입장. 같은 이름 재입장 시 기존 좌석 유지
- 관리자: 똑같이 이름으로 입장 → 화면 맨 아래 왼쪽 `관리자 모드` → PIN → 우측 상단 ⚙️
- 브라우저가 초기화돼도 같은 이름 + PIN으로 복구
- LIVE 송출 (관리자 ⚙️ → 🔴 LIVE 송출): 게임·맵·FINAL 인원 선택 → 참가자 선택 → ▶️ LIVE START
  - 관리자 폰에서 seed(서버 발급)로 1회 시뮬레이션 → 업로드 → 5초 뒤 전원 동시 재생 (결과는 재생 끝까지 비공개)
  - 참가자 화면은 강제로 바꾸지 않음: 시작 알림 + 🎮 탭 LIVE 표시 + [LIVE 보기] 버튼으로 이동. 중간 접속/복귀해도 진행 지점부터 재생
  - 재생이 끝나면 `📢 선택 순번 안내 시작` → `다음 ▶` 로 "지금 차례: A → 다음: B" 진행
  - `⏹ 송출 종료` → 전원 LIVE 대기 화면 + 직전 결과 유지
  - 결과 계산/업로드 중 관리자 폰이 꺼지면: 패널에서 `🔁 같은 seed로 다시 업로드` (결과 동일, 리롤 아님)
- 🎯 사격: 관리자 패널 `🎯 사격 점수`에 입력 → 사격 탭에 순위 자동 정렬 (🥇🥈🥉, 동점은 '공동 n위', 최저점 💩 표시만)
  - 공동 1·2·3위 → 현장 재사격 → 맞힌 수를 '2차전' 칸에 입력 (빈칸 = 2차전 안 함). 앱은 순위만 보여주고 게임과 연동하지 않음
  - `사격 1위가 고른 상품` 입력 → 남은 상품이 FINAL 1위 상품으로 표시
- 🎡 돌림판: 관리자가 대상자 이름을 직접 골라 LIVE로 돌림 → 1명 당첨 (꼴찌 동점 결정도 동일, 사격 순위와 연동 없음)
- ⚡ 반응속도 FINAL: FINAL 3명 선택 → START → 바로 첫 플레이어부터 본게임 3판 (순서는 서버가 무작위)
  - 연습은 각자 🎮 게임 > 🕹 연습에서 (LIVE 중에도 가능, 3판 평균으로 FINAL과 같은 방식)
  - 플레이어 폰은 자기 차례에 자동으로 풀스크린 (관리자 패널 위에도). `준비 완료` → 빨강 → 초록이면 탭
  - 초록 전에 누르거나 100ms 미만, 대기 중 앱 이탈 → 그 판 무효 후 다시
  - 관리자: `대신 시작` / `판 무효 · 재시도` / `스킵`. 본게임 평균 → 최고 기록 → 그래도 같으면 동점자만 추가 1판
  - 결과는 3위 → 2위 → 1위 순서로 공개, 1위는 상품과 함께
  - FINAL 백업: 구슬 레이스·사다리에서 `🏆 FINAL 백업 시상` 체크 → 같은 방식으로 3위부터 공개
  - 관리자 버튼은 누른 순간의 진행 상태를 함께 보내서, 확인창 사이에 판이 끝났으면 거부 → 화면 확인 후 다시

## 구조

```
supabase/schema.sql          테이블, RLS, RPC, 단일 방 SEED
.github/workflows/deploy.yml GitHub Pages 자동 배포
lib/supabase.js              클라이언트 + RPC 에러 → 한국어 메시지
lib/session.js               기기 ID, 세션 (localStorage)
lib/time.js                  서버 시각 offset, KST 포맷, 카운트다운
lib/useRoom.js               데이터 로드 + Realtime + 복귀/20초 주기 재동기화
lib/seatLayout.js            28인승 배치 (실제 배치도 받으면 여기만 수정)
lib/ui.js                    토스트, 확인 팝업, 화면 꺼짐 방지
lib/useLive.js               LIVE 라운드 + 재생 데이터 (Realtime + 복귀/주기 재확인)
lib/prizes.js                경품 / 시상 룰 문구 (사격 1위 선택 → FINAL 1위 상품)
lib/games.js                 게임 목록, seed → 결과 계산(prepareRound), 종료 판정
lib/shoot.js                 사격 순위 (공동 순위, 🥇🥈🥉💩)
lib/marble/                  🎱 구슬 레이스: maps.js(원본 맵), engine.js(시뮬레이션·궤적), render.js(재생)
lib/wheel/plan.js            🎡 seed → 당첨자·최종 각도 / lib/spin-wheel/ (원본 라이브러리)
lib/ladder/                  🪜 plan.js(seed → 사다리·순위), whozzie.js(원본 사다리 생성·좌표)
lib/reaction/core.js         ⚡ 판 이름, 기록판 집계
app/page.js                  메인 (입장, 탭, 관리자 모드, LIVE 알림·[LIVE 보기], FINAL 플레이 화면)
components/                  탭 화면, 관리자 패널 (LiveAdmin = 송출, LiveView = 관전)
public/                      fadu-logo.png (헤더·입장 화면 로고)
```

## 보안 모델

- 모든 쓰기는 `SECURITY DEFINER` RPC로만. 테이블 직접 쓰기는 RLS로 차단
- PIN은 bcrypt 해시로 저장, 검증은 서버에서만. 5회 실패 시 1분 잠금
- 참가자 토큰 / 관리자 세션 토큰은 select 불가 테이블에 보관
- 좌석 오픈 판정, 동시 클릭 처리(조건부 UPDATE), 1인 1좌석(UNIQUE)은 DB에서 보장
- anon 키는 공개용 키라 프론트 코드에 포함돼도 무방 (권한은 RLS/RPC로 제한)

## 리허설 체크리스트

- [ ] 아이폰 / 갤럭시 각 1대로 QR 입장
- [ ] 관리자 모드 PIN 진입, 틀린 PIN 5회 → 잠금
- [ ] 오픈 시각을 2분 뒤로 설정 → 카운트다운 → 자동 활성화
- [ ] 두 폰으로 같은 좌석 동시 선택 → 한 명만 성공, 다른 쪽 "이미 예약된 좌석입니다"
- [ ] 좌석 변경 / 취소 / 운영석 지정 / 대리 배정 / 리셋
- [ ] 브라우저 데이터 삭제 후 같은 이름으로 재입장 → 좌석 유지, PIN으로 관리자 복구
- [ ] 앱 전환 후 복귀 시 좌석 상태가 최신으로 갱신되는지
- [ ] 아이폰/갤럭시 5~6대로 LIVE 1라운드: 동시 재생, 늦게 연 폰의 seek, 다른 탭에 있던 폰의 알림·[LIVE 보기]
- [ ] 재생 중 화면 꺼짐 여부 (Wake Lock 미지원 기기는 "화면 켜두기" 공지)
- [ ] 관리자 폰 시뮬레이션 소요 시간 (맵별, 19명) — Pot of greed가 가장 김
- [ ] 선택 순번 안내 다음/이전, 송출 종료 후 대기 화면
- [ ] 사격 점수 입력 → 사격 탭 정렬·💩, 1위 상품 선택 → LIVE 대기 화면 FINAL 1위 상품 변경
- [ ] 🎡 돌림판 2명 → 8칸 반복, 🪜 사다리 19명 가로 스크롤
- [ ] ⚡ 반응속도: 기기별 10판 편차 확인 (60/120Hz), 부정출발·앱 이탈 무효, 관리자 대신 시작/무효/스킵, 관리자 본인이 플레이어일 때
- [ ] 리허설 끝나면 관리자 메뉴 → 전체 초기화

## 알려진 제한

- 실제 Supabase(RPC·Realtime) 연동은 리허설 체크리스트로 확인 필요
- 좌석 배치는 실제 배치도 기준 반영 완료 (`lib/seatLayout.js`)
- 일정은 시각(HH:MM)만 저장. 당일 기준 강조
- 🎱 구슬 레이스 맵·물리 로직은 [lazygyu/roulette](https://github.com/lazygyu/roulette) (MIT, `lib/marble/LICENSE`) 이식.
  원본 README에 따라 "Marble Roulette" 및 유사 명칭은 사용하지 않음
- 가져온 오픈소스 (모두 MIT, 라이선스 전문 동봉)
  - 🎡 [CrazyTim/spin-wheel](https://github.com/CrazyTim/spin-wheel) v5.0.2 → `lib/spin-wheel/` (원본 그대로, 회전 각도만 우리 시계로 지정)
  - 🪜 [zeikar/whozzie](https://github.com/zeikar/whozzie) 사다리 생성·경로·좌표 → `lib/ladder/whozzie.js`
  - ⚡ [SultanAni/reaction-time-game](https://github.com/SultanAni/reaction-time-game) 상태·색상 + [tarcisiozf/reaction-time](https://github.com/tarcisiozf/reaction-time) 원형 → `components/ReactionPad.js` (`lib/reaction/LICENSE`)
  - 스펙에 적힌 반응속도 repo 2개는 LICENSE 파일이 없어 사용하지 않음
- 경품 문구는 `lib/prizes.js` 고정값 (상품이 바뀌면 여기만 수정)
