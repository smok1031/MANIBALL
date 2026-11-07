# KEI FC 팀 매니저 (웹)

일정, 참석 투표, 현장 출석, 라인업, 경기 기록, 회비와 벌금, 공지와 설문, MOM 투표를 한곳에서 관리하는 팀 앱입니다.
화면과 기능은 Claude 아티팩트로 만든 앱과 같고, 로그인(카카오, 이메일)과 팀 초대 링크가 더해졌습니다.

- 앱 주소: https://smok1031.github.io/kei-fc/
- 로그인 없이 둘러보기: [팀원 화면](https://smok1031.github.io/kei-fc/?demo=member), [운영진 화면](https://smok1031.github.io/kei-fc/?demo=op) (예시 데이터, 저장 안 됨)

## 역할

| 역할 | 할 수 있는 일 |
| --- | --- |
| 팀장 | 운영진의 모든 일, 운영진 지정과 해제, 멤버 내보내기, 초기화와 백업 복원 |
| 운영진 | 일정, 현장 출석, 라인업, 기록, 회비, 벌금, 선수, 공지 관리, 초대 링크 만들기 |
| 팀원 | 본인 참석 투표, MOM과 설문 투표, 본인 회비와 벌금만 보기 (선수 탭 없음) |

권한은 서버(Supabase)의 행 단위 보안 규칙으로 지킵니다. 팀원은 다른 사람의 벌금, 회비, 투표 내용을 읽을 수 없습니다.

## 처음 한 번만 하는 설정

### 1. Supabase 프로젝트
1. https://supabase.com/dashboard 에서 프로젝트를 엽니다. 일시 정지(Paused) 상태면 Restore를 누릅니다.
2. 왼쪽 **SQL Editor** > **New query**에 `supabase/schema.sql` 전체를 붙여 넣고 **Run**을 누릅니다. 여러 번 실행해도 안전합니다.
3. **Authentication** > **URL Configuration**
   - Site URL: `https://smok1031.github.io/kei-fc/`
   - Redirect URLs에 추가: `https://smok1031.github.io/kei-fc/**`
4. **Project Settings** > **API**(또는 API Keys)에서 **Project URL**과 **publishable key**(없으면 anon public key)를 복사합니다.
   - 이 두 값만 `src/config.js`에 들어갑니다. **secret key와 service_role key는 절대 넣거나 보내지 마세요.**

### 2. 카카오 로그인
1. https://developers.kakao.com 에서 **앱 만들기**.
2. **앱 설정** > **앱** > **플랫폼 키**의 **REST API 키**를 엽니다.
   - **카카오 로그인 리다이렉트 URI**: `https://<프로젝트 ref>.supabase.co/auth/v1/callback`
   - **카카오 로그인 Client Secret**을 활성화하고 코드를 복사합니다.
3. **제품 설정** > **카카오 로그인**: 사용 설정 **ON**.
4. **동의항목**: 닉네임(profile_nickname), 프로필 사진(profile_image), 카카오계정 이메일(account_email, 선택 동의).
   - Supabase는 이메일 동의항목을 항상 요청합니다. 이메일 항목이 설정돼 있지 않으면 카카오 화면에 KOE205 오류가 납니다.
   - 이메일 항목은 비즈 앱에서만 켤 수 있습니다. 앱 설정의 비즈니스 정보에서 비즈 앱으로 전환해 주세요 (개인 개발자도 본인 인증으로 전환할 수 있습니다).
5. Supabase **Authentication** > **Providers** > **Kakao**
   - Kakao Enabled 켜기, Client ID에 REST API 키, Client Secret에 위 코드 (Client Secret은 Supabase에만 넣습니다)
   - **Allow users without an email** 켜기 (이메일 제공을 거절한 사람도 로그인)

이메일 로그인 링크는 Supabase 기본 메일 서버로 보내져 시간당 보낼 수 있는 수가 적습니다. 팀원은 카카오 로그인을 권합니다.

### 3. 팀 만들기와 데이터 옮기기
1. 앱 주소에서 카카오로 로그인하고 **새 팀 만들기**로 `KEI FC`를 만듭니다. 만든 사람이 팀장입니다.
2. 기존 아티팩트 앱의 **설정** > **백업 파일 받기**로 파일을 받고, 웹 앱의 **설정** > **백업에서 복원**으로 올립니다.
3. **설정** > **팀과 권한**의 **초대 문구 보기**를 단톡방에 올립니다. 링크로 로그인한 사람은 팀원이 됩니다.
4. 운영진은 같은 카드의 멤버 목록에서 팀장이 **운영진**으로 바꿉니다.
5. 팀원은 처음 들어오면 **나 찾기**로 본인 선수를 고릅니다.

## 개발

```bash
npm install
npm run dev      # 로컬에서 보기
npm run build    # dist/ 에 배포용 파일 생성
```

- `app-src/`: 팀 매니저 화면과 기능 (아티팩트 앱과 같은 코드)
- `tools/build-app.mjs`: `app-src`를 `public/app.js`, `public/style.css`로 묶고 웹에 맞는 문구로 바꿈
- `src/web.js`: 로그인, 팀 만들기와 초대, 팀 고르기, Supabase 문서 저장소 연결
- `supabase/schema.sql`: 표, 권한 규칙, 집계 트리거, 함수
- `supabase/test/`: 로컬 Postgres로 권한 규칙 시험(`rls_test.py`), 앱 전체 흐름 시험(`e2e.cjs`, `fake_rest.py`)

배포는 `dist/`의 내용을 `gh-pages` 브랜치에 올리는 방식입니다. GitHub 저장소 **Settings** > **Pages**에서 Source를 `Deploy from a branch`, 브랜치를 `gh-pages` / `(root)`로 둡니다.
