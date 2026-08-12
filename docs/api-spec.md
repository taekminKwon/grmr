# API 명세

`docs/feature-spec.md`의 기능을 기준으로 설계한 REST API 초안입니다. 아직 컨트롤러 구현은 없으며, 이 문서는 `backend/` 구현의 기준이 됩니다. 실제 구현 중 필요에 따라 갱신하세요.

엔드포인트별 요청/응답 필드를 상세히 정리한 문서는 [docs/api-spec-detail.md](api-spec-detail.md)를 참고하세요.

## 공통 규칙

- Base path: `/api`
- 요청/응답 포맷: JSON (`application/json`)
- 인증: JWT 기반. `/api/auth/**`를 제외한 모든 엔드포인트는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다. 관리자 전용 엔드포인트(`/api/questions/**`, `/api/assignments/**`, `/api/students/**`, `/api/study-records`, `/api/dashboard/admin`)는 `ROLE_ADMIN`, 학생 전용(`/api/me/**`)은 `ROLE_STUDENT` 권한이 필요합니다. 상세는 아래 [인증 (Auth)](#인증-auth) 참고.
- 목록 조회 응답은 페이지네이션을 사용합니다: `{ "content": [...], "page": 0, "size": 20, "totalElements": 0 }`
- 에러 응답: `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }` + 적절한 HTTP 상태 코드
- 날짜: `YYYY-MM-DD`, 일시: ISO-8601 (`YYYY-MM-DDTHH:mm:ss`)

## 인증 (Auth)

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/auth/login` | 로그인. `loginId`/`password` 검증 후 access/refresh token 발급 |
| POST | `/api/auth/refresh` | refresh token으로 access/refresh token 재발급 (회전) |
| POST | `/api/auth/logout` | 로그아웃. 서버(Redis)에 저장된 refresh token 무효화 |

**POST `/api/auth/login` 요청 예시**
```json
{
  "loginId": "admin01",
  "password": "password123!"
}
```

**응답 예시**
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "role": "ADMIN",
  "name": "권태민"
}
```

refresh token은 회원 계정(`memberId`)을 키로 Redis에 저장되며, 로그인/재발급 시 갱신되고 로그아웃 시 삭제됩니다. 회원당 refresh token은 항상 1개만 유지되므로 동시 활성 세션도 1개로 제한되며, 다른 곳에서 새로 로그인하면 기존 refresh token이 새 토큰으로 교체되어 이전 세션은 즉시 무효화됩니다. 상세는 [docs/api-spec-detail.md](api-spec-detail.md#인증-auth) 참고.

## 문제 (Question)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/questions` | 문제 목록 조회. 쿼리: `category`, `type`, `level`, `status`, `keyword`, `page`, `size` |
| GET | `/api/questions/{id}` | 문제 상세 조회 |
| POST | `/api/questions` | 문제 직접 등록 (초안으로 생성) |
| PATCH | `/api/questions/{id}` | 문제 내용 수정 |
| PATCH | `/api/questions/{id}/status` | 문제 상태 변경 (`사용 중` ↔ `사용 중지`) |

**Phase 1(MVP) 범위**: 문제 유형(`type`)은 객관식(`MULTIPLE_CHOICE`, 표시 라벨 "객관식")만 지원합니다. `빈칸`/`오류 찾기`는 향후 단계에서 지원 예정인 미래 범위로, Phase 1에서는 사용하지 않습니다.

**상태(`status`) 전이 규칙**: 상태 값은 `초안`/`사용 중`/`사용 중지` 세 가지이며, `PATCH /api/questions/{id}/status`로만 변경합니다(생성 시 항상 `초안`으로 시작).

| 현재 상태 → 목표 상태 | `초안` | `사용 중` | `사용 중지` |
| --- | --- | --- | --- |
| **`초안`** | (자기 자신, 요청 대상 아님) | 허용 | **금지** |
| **`사용 중`** | **금지** | 허용(멱등) | 허용 |
| **`사용 중지`** | **금지** | 허용 | 허용(멱등) |

- `초안` → `사용 중지` 직접 전이는 금지입니다(`409 Conflict`, `INVALID_STATUS_TRANSITION`).
- 어떤 상태에서든 `초안`으로 되돌리는 전이는 금지입니다(`400 Bad Request`, `INVALID_QUESTION`). 초안은 최초 생성 시에만 부여되는 상태입니다.
- 상세 에러 응답과 근거는 [docs/api-spec-detail.md의 상태 변경 섹션](api-spec-detail.md#patch-apiquestionsidstatus--문제-상태-변경)을 참고하세요.

**POST `/api/questions` 요청 예시**
```json
{
  "category": "현재완료",
  "type": "객관식",
  "level": "보통",
  "text": "He has lived here _____ 2010.",
  "choices": ["for", "since", "during", "from"],
  "answer": "since",
  "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다."
}
```

**응답 공통 필드**: `id`, `category`, `type`, `level`, `status`, `text`, `choices`, `answer`, `explanation`, `createdAt`

### GPT 문제 생성

| Method | Path | 설명 |
| --- | --- | --- |
| POST | `/api/questions/generate` | GPT로 문제 초안 생성 (미저장, 검수용) |
| POST | `/api/questions/generate/save` | 검수 완료된 생성 문제를 초안으로 일괄 저장 |

**POST `/api/questions/generate` 요청**
```json
{
  "category": "현재완료",
  "level": "보통",
  "type": "객관식",
  "count": 5,
  "prompt": "중학교 1학년 수준의 쉬운 어휘를 사용해 주세요."
}
```
응답은 `{ "drafts": [...] }` 형태이며, `drafts` 배열의 각 항목은 `Question`과 동일한 필드(`id` 없음)입니다.

**POST `/api/questions/generate/save` 요청**: 위 응답을 검수 후(필요시 수정) `{ "drafts": [...] }` 형태 그대로 전달 → 각 항목이 `상태: 초안`으로 저장됩니다.

## 과제 (Assignment)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/assignments` | 과제 목록 조회. 쿼리: `status`, `keyword`, `page`, `size` |
| GET | `/api/assignments/{id}` | 과제 상세 조회 (포함된 문제 목록 포함) |
| POST | `/api/assignments` | 과제 생성 |
| PATCH | `/api/assignments/{id}` | 과제 수정 (대상, 마감일, 문제 구성) |
| DELETE | `/api/assignments/{id}` | 과제 삭제 |

**POST `/api/assignments` 요청 예시**
```json
{
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "targetId": "중1 A반",
  "dueDate": "2026-08-10",
  "questionIds": [1024, 1023, 1021]
}
```

**응답 필드**: `id`, `title`, `target`, `dueDate`, `status`, `progress`(제출률, %)

## 학생 (Student, 관리자 관점)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/students` | 학생 목록 조회. 쿼리: `group`, `keyword`, `page`, `size` |
| GET | `/api/students/{id}` | 학생 상세 조회 (그룹, 최근 학습일, 누적 정답률, 미제출 건수) |

학생 등록/수정/삭제는 기능 명세상 범위 밖으로, 엔드포인트를 정의하지 않습니다.

## 학습 이력 (StudyRecord)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/study-records` | 학습 이력 조회 (관리자용). 쿼리: `studentId`, `period`(`7d`/`30d`), `type`(`ASSIGNMENT`/`PRACTICE`), `page`, `size` |
| GET | `/api/me/history` | 내 학습 이력 조회 (학생 본인). 쿼리: `period`, `type`(`ASSIGNMENT`/`PRACTICE`) |

**응답 필드**: `studentId`, `studentName`, `date`, `type`, `questionCount`, `accuracy`, `durationMinutes`

`type`의 API 쿼리·응답 값은 항상 `ASSIGNMENT`(과제) 또는 `PRACTICE`(자유 학습)입니다. "과제"/"자유 학습"은 화면 표시용 한글 라벨일 뿐 API 값으로는 사용하지 않습니다.

## 대시보드

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/dashboard/admin` | 관리자 대시보드 지표(학생 수, 오늘 학습 학생, 과제 현황, 문법별 정답률, 미제출 알림) |
| GET | `/api/me/dashboard` | 학생 대시보드 지표(오늘 푼 문제, 오늘 정답률, 오늘 학습 시간, 취약 문법 TOP3) |

## 내 과제 / 문제 풀이 (학생)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/assignments` | 내 과제 목록 (진행률, 마감일 포함) |
| GET | `/api/me/assignments/{assignmentId}/questions` | 과제에 포함된 문제 목록(풀이용 — 정답/해설 제외) |
| POST | `/api/me/assignments/{assignmentId}/answers` | 답안 제출/임시 저장 |
| GET | `/api/me/practice/questions` | 자유 학습용 문제 조회. 쿼리: `category`(취약 문법 우선) |
| POST | `/api/me/practice/answers` | 자유 학습 답안 제출/임시 저장 |

**POST `/api/me/assignments/{assignmentId}/answers` 요청**
```json
{
  "questionId": 1024,
  "answer": "since",
  "final": true
}
```
`final: false`는 임시 저장, `true`는 채점까지 수행합니다.

**응답 (채점 결과)**
```json
{
  "questionId": 1024,
  "correct": true,
  "answer": "since",
  "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다."
}
```

**POST `/api/me/practice/answers` 요청**: `assignmentId`가 없다는 점을 제외하면 위 과제 답안 제출과 요청/응답 형식이 동일합니다.
```json
{
  "questionId": 1021,
  "answer": "were",
  "final": true
}
```
`final: false`는 임시 저장(`{ "saved": true }` 응답), `true`는 채점까지 수행하고 위와 동일한 형태의 채점 결과를 반환합니다. 대상 문제가 `사용 중` 상태가 아니면(`초안`/`사용 중지`) 제출할 수 없습니다. 상세는 [docs/api-spec-detail.md](api-spec-detail.md#post-apimepracticeanswers--자유-학습-답안-제출임시-저장) 참고.

## 오답노트 (WrongAnswer)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/wrong-answers` | 오답노트 조회. 쿼리: `category`, `status`(`미복습`/`복습 중`/`해결`) |
| POST | `/api/me/wrong-answers/{id}/retry` | 오답 문제 다시 풀기 시작 (문제 풀이 화면 진입용 데이터 반환) |

**응답 필드**: `id`, `questionId`, `questionText`, `category`, `wrongCount`, `lastWrongAt`, `status`
