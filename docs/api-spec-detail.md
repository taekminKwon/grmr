# API 상세 명세

[docs/api-spec.md](api-spec.md)의 엔드포인트 목록을 기준으로, 엔드포인트별 요청/응답을 필드 단위로 정리한 상세 명세입니다. 값 표기(예: `category: "현재완료"`, `status: "사용 중"`)는 `api-spec.md`와 동일하게 와이어프레임의 한글 값을 그대로 사용합니다. 실제 구현 시 필요하면 이 문서를 갱신하세요.

## 공통 규칙

- Base path: `/api`, 포맷: `application/json`
- 목록 조회는 페이지네이션 응답을 사용합니다.
  ```json
  { "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }
  ```
- 공통 에러 응답: `{ "code": "...", "message": "..." }`
  - 요청 바디/경로변수/쿼리파라미터의 형식이 올바르지 않은 경우(JSON 파싱 실패, 타입 불일치 등)에도 `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }`로 응답합니다.
- 표에서 **필수**는 요청 바디 기준이며, 응답 전용 필드는 필수 열을 비워둡니다.
- 인증: `/api/auth/**`를 제외한 모든 엔드포인트는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다.
  - 토큰 누락/만료/위조: `401 Unauthorized` — `{ "code": "TOKEN_EXPIRED", "message": "..." }` 또는 `{ "code": "TOKEN_INVALID", "message": "..." }`
  - 권한 부족(역할 불일치, 예: 학생이 관리자 API 호출): `403 Forbidden` — `{ "code": "FORBIDDEN", "message": "접근 권한이 없습니다." }`
  - `/api/questions/**`, `/api/assignments/**`, `/api/students/**`, `/api/study-records`, `/api/dashboard/admin`은 `ROLE_ADMIN`, `/api/me/**`는 `ROLE_STUDENT`만 접근할 수 있습니다(`global/security/SecurityConfig.java` 기준).
- `/api/me/**` 엔드포인트는 학생 식별을 항상 access token의 `memberId`(subject)로부터 얻으며, 요청 바디·경로·쿼리로 학생 ID를 받지 않습니다(다른 학생의 자원에 접근할 방법 자체가 없음). 이 규칙은 모든 `/api/me/**` 엔드포인트에 공통이며, 이 문서의 각 절에서 반복 설명하지 않습니다.

---

## 인증 (Auth)

**세션 정책**: 회원(`memberId`)당 refresh token은 Redis에 항상 1개만 저장되므로, 동시에 유효한 세션도 회원당 1개로 제한됩니다. 이미 로그인한 상태에서 다른 기기/브라우저로 다시 로그인하면 기존 refresh token이 새 토큰으로 교체(대체)되며, 교체되는 즉시 이전 refresh token은 무효화되어 이전 세션은 재발급/로그아웃 요청 시 `401 Unauthorized`(`INVALID_REFRESH_TOKEN`)를 받습니다.

### POST `/api/auth/login` — 로그인

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `loginId` | string | ✓ | 로그인 아이디 |
| `password` | string | ✓ | 비밀번호 |

```json
{
  "loginId": "admin01",
  "password": "password123!"
}
```

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `accessToken` | string | JWT access token |
| `refreshToken` | string | refresh token (Redis에 `memberId` 키로 저장) |
| `tokenType` | string | 고정값 `"Bearer"` |
| `expiresIn` | int | access token 만료(초) |
| `role` | string | `ADMIN` 또는 `STUDENT` |
| `name` | string | 로그인한 회원 이름 |

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

**Error**: `401 Unauthorized` `{ "code": "INVALID_CREDENTIALS", "message": "아이디 또는 비밀번호가 올바르지 않습니다." }`

---

### POST `/api/auth/refresh` — 토큰 재발급

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `refreshToken` | string | ✓ | 발급받은 refresh token |

```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Response** `200 OK` — refresh token은 재사용을 막기 위해 매 요청마다 새로 발급(회전)합니다.
```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "expiresIn": 3600
}
```

**Error**: `401 Unauthorized` `{ "code": "INVALID_REFRESH_TOKEN", "message": "유효하지 않거나 만료된 토큰입니다." }` — Redis에 해당 토큰이 없거나(이미 사용/만료/로그아웃) 값이 일치하지 않는 경우

---

### POST `/api/auth/logout` — 로그아웃

**Header**: `Authorization: Bearer {accessToken}`

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `refreshToken` | string | ✓ | 무효화할 refresh token |

```json
{ "refreshToken": "eyJhbGciOi..." }
```

**Response** `204 No Content` — Redis에서 해당 `memberId`의 refresh token을 삭제합니다.

---

## 문제 (Question)

**Phase 1(MVP) 범위**: 문제 유형(`type`)은 객관식(`MULTIPLE_CHOICE`, 표시 라벨 "객관식")만 지원합니다. 이 문서에 등장하는 `빈칸`/`오류 찾기`는 향후 단계에서 지원 예정인 미래 범위이며, Phase 1의 요청/응답에서는 사용하지 않습니다.

### 상태(`status`) 전이 매트릭스

문제 상태는 `초안`/`사용 중`/`사용 중지` 세 가지이며, `POST /api/questions`로 생성된 문제는 항상 `초안`으로 시작합니다. 상태는 [`PATCH /api/questions/{id}/status`](#patch-apiquestionsidstatus--문제-상태-변경)로만 변경하며, 아래 매트릭스가 유일한 기준입니다.

| 현재 상태 → 목표 상태 | `초안` | `사용 중` | `사용 중지` |
| --- | --- | --- | --- |
| **`초안`** | 요청 대상 아님(생성 시에만 부여) | 허용 | **금지** |
| **`사용 중`** | **금지** | 허용(멱등, no-op) | 허용 |
| **`사용 중지`** | **금지** | 허용 | 허용(멱등, no-op) |

- **`초안` → `사용 중지`**: 금지. `409 Conflict` `{ "code": "INVALID_STATUS_TRANSITION", "message": "초안 상태에서는 사용 중지로 변경할 수 없습니다." }`
- **모든 상태 → `초안`**: 금지. 현재 상태와 무관하게 `400 Bad Request` `{ "code": "INVALID_QUESTION", "message": "초안 상태로는 변경할 수 없습니다: {요청한 status}" }`. 초안은 문제를 새로 등록할 때만 부여되는 상태이며, 상태 변경 API로는 절대 되돌릴 수 없습니다.
- **`사용 중` ↔ `사용 중지`**: 양방향 모두 허용. 이미 목표 상태와 같은 상태로 요청해도(`사용 중`→`사용 중`, `사용 중지`→`사용 중지`) 에러 없이 멱등하게 처리됩니다.

### GET `/api/questions` — 문제 목록 조회

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `category` | string | | 문법 항목 필터 (예: `현재완료`) |
| `type` | string | | 문제 유형 필터 (`객관식`/`빈칸`/`오류 찾기`) |
| `level` | string | | 난이도 필터 (`기초`/`보통`/`심화`) |
| `status` | string | | 상태 필터 (`초안`/`사용 중`/`사용 중지`) |
| `keyword` | string | | 문제 내용 검색어 |
| `page` | int | | 기본값 0 |
| `size` | int | | 기본값 20 |

**Response** `200 OK`
```json
{
  "content": [
    {
      "id": 1024,
      "category": "현재완료",
      "type": "객관식",
      "level": "보통",
      "status": "사용 중",
      "text": "He has lived here _____ 2010."
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```
목록 응답은 상세 화면 전용 필드(`choices`, `answer`, `explanation`)를 포함하지 않습니다.

---

### GET `/api/questions/{id}` — 문제 상세 조회

**Path Parameters**: `id` (long)

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | |
| `category` | string | |
| `type` | string | |
| `level` | string | |
| `status` | string | |
| `text` | string | 문제 본문 |
| `choices` | string[] | 객관식 보기 (`type`이 `객관식`이 아니면 빈 배열) |
| `answer` | string | 정답 |
| `explanation` | string | 해설 |
| `createdAt` | datetime | |

```json
{
  "id": 1024,
  "category": "현재완료",
  "type": "객관식",
  "level": "보통",
  "status": "사용 중",
  "text": "He has lived here _____ 2010.",
  "choices": ["for", "since", "during", "from"],
  "answer": "since",
  "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.",
  "createdAt": "2026-07-20T10:15:00"
}
```

**Error**: `404 Not Found` `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }`

---

### POST `/api/questions` — 문제 직접 등록

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `category` | string | ✓ | 문법 항목 |
| `type` | string | ✓ | `객관식`/`빈칸`/`오류 찾기` |
| `level` | string | ✓ | `기초`/`보통`/`심화` |
| `text` | string | ✓ | 문제 본문 |
| `choices` | string[] | `type`이 `객관식`일 때 ✓ | 보기 목록 |
| `answer` | string | ✓ | 정답 |
| `explanation` | string | ✓ | 해설 |

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

**Response** `201 Created`, `Location: /api/questions/{id}`

등록된 문제는 항상 `status: "초안"`으로 생성됩니다. 응답 바디는 GET 상세 조회와 동일한 구조입니다.

```json
{
  "id": 1030,
  "category": "현재완료",
  "type": "객관식",
  "level": "보통",
  "status": "초안",
  "text": "He has lived here _____ 2010.",
  "choices": ["for", "since", "during", "from"],
  "answer": "since",
  "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다.",
  "createdAt": "2026-08-07T09:00:00"
}
```

**Error**: `400 Bad Request` `{ "code": "INVALID_QUESTION", "message": "정답은 보기 목록에 포함되어야 합니다." }`

---

### PATCH `/api/questions/{id}` — 문제 내용 수정

**Path Parameters**: `id` (long)

**Request Body**: `POST /api/questions`와 동일한 필드 중 변경할 항목만 포함 (부분 수정)

```json
{
  "text": "He has lived here _____ 2015.",
  "explanation": "특정 시작 시점과 함께 쓰이는 since로 수정."
}
```

**Response** `200 OK`: 수정된 문제 상세 (GET 상세 조회와 동일 구조)

**Error**: `404 Not Found`(`QUESTION_NOT_FOUND`), `400 Bad Request`(`INVALID_QUESTION`)

---

### PATCH `/api/questions/{id}/status` — 문제 상태 변경

**Path Parameters**: `id` (long)

전이 가능 여부는 [상태(`status`) 전이 매트릭스](#상태status-전이-매트릭스)를 따릅니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `status` | string | ✓ | `사용 중` 또는 `사용 중지` (`초안`은 허용되지 않는 목표 값) |

```json
{ "status": "사용 중지" }
```

**Response** `200 OK`
```json
{ "id": 1024, "status": "사용 중지" }
```

**Error**:
- `404 Not Found` `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }`
- `409 Conflict` `{ "code": "INVALID_STATUS_TRANSITION", "message": "초안 상태에서는 사용 중지로 변경할 수 없습니다." }` — 현재 상태가 `초안`인데 `사용 중지`를 요청한 경우
- `400 Bad Request` `{ "code": "INVALID_QUESTION", "message": "초안 상태로는 변경할 수 없습니다: {status}" }` — `status`로 `초안`을 요청한 경우(현재 상태 무관)

---

### POST `/api/questions/generate` — GPT 문제 생성 (미저장)

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `category` | string | ✓ | 문법 항목 |
| `level` | string | ✓ | 난이도 |
| `type` | string | ✓ | 문제 유형 |
| `count` | int | ✓ | 생성 개수 (1~10) |
| `prompt` | string | | 추가 지시사항 |

```json
{
  "category": "현재완료",
  "level": "보통",
  "type": "객관식",
  "count": 3,
  "prompt": "중학교 1학년 수준의 쉬운 어휘를 사용해 주세요."
}
```

**Response** `200 OK` — 저장되지 않은 초안 배열 (`id` 없음, 검수용)
```json
{
  "drafts": [
    {
      "category": "현재완료",
      "type": "객관식",
      "level": "보통",
      "text": "She has studied English _____ three years.",
      "choices": ["for", "since", "during", "from"],
      "answer": "for",
      "explanation": "기간을 나타낼 때 for를 사용합니다."
    }
  ]
}
```

**Error**: `502 Bad Gateway` `{ "code": "GPT_GENERATION_FAILED", "message": "문제 생성에 실패했습니다. 다시 시도해주세요." }`

---

### POST `/api/questions/generate/save` — 생성된 문제 초안 저장

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `drafts` | object[] | ✓ | `POST /api/questions/generate` 응답의 `drafts` 배열(검수 중 수정 가능) |

```json
{
  "drafts": [
    {
      "category": "현재완료",
      "type": "객관식",
      "level": "보통",
      "text": "She has studied English _____ three years.",
      "choices": ["for", "since", "during", "from"],
      "answer": "for",
      "explanation": "기간을 나타낼 때 for를 사용합니다."
    }
  ]
}
```

**Response** `201 Created` — 저장된 문제 목록 (모두 `status: "초안"`)
```json
{
  "saved": [
    { "id": 1031, "category": "현재완료", "type": "객관식", "level": "보통", "status": "초안", "text": "She has studied English _____ three years." }
  ]
}
```

---

## 과제 (Assignment)

**Phase 3(MVP) 구현 범위**입니다. `/api/assignments/**` 전체가 `ROLE_ADMIN` 전용입니다([공통 규칙](#공통-규칙) 참고).

### 상태(`status`) 계산 규칙

과제 상태는 `예정`/`진행 중`/`마감` 세 값이며, 문제 상태와 달리 **별도의 상태 변경 API가 없고 서버가 `startDate`/`dueDate`를 기준으로 매 요청마다 자동 계산**합니다(별도 배치/스케줄러 없이 조회 시점에 계산):

| 조건(오늘 = 서버 기준일) | 상태 |
| --- | --- |
| 오늘 `<` `startDate` | `예정` |
| `startDate` ≤ 오늘 ≤ `dueDate` | `진행 중` |
| 오늘 `>` `dueDate` | `마감` |

경계일(`startDate` 당일, `dueDate` 당일)은 모두 `진행 중`에 포함됩니다. 생성 직후 상태는 `startDate`가 오늘이거나 과거이면 `진행 중`, 미래이면 `예정`입니다.

**검증 규칙**: `startDate ≤ dueDate`가 항상 성립해야 합니다. 생성(`POST`)·수정(`PATCH`) 시 이를 위반하면 `400 Bad Request`(`INVALID_ASSIGNMENT`)를 반환합니다. 두 값이 같은 경우(당일 시작·당일 마감)는 허용됩니다.

도메인 용어 정의는 [feature-spec.md](feature-spec.md#도메인-용어)를 참고하세요.

### 대상(target) 지정

새로운 반/그룹 데이터 모델을 만들지 않고 [학생(Student)](#학생-student-관리자-관점)의 기존 필드를 재사용합니다.

| `targetType` | 대상 지정 필드 | 설명 |
| --- | --- | --- |
| `CLASS` | `targetGroup` (string, ✓) | `Student.studentGroup`과 동일한 문자열(예: `"중1 A반"`). 해당 그룹에 속한 모든 학생이 대상. |
| `STUDENT` | `targetStudentId` (long, ✓) | `Student.id`(=`/api/students/{id}`의 `id`). 해당 학생 1명만 대상. |

`targetType`에 해당하지 않는 필드는 요청에 포함하지 않거나 무시됩니다. 응답의 `target`은 화면 표시용 문자열입니다(`targetType: CLASS`면 `targetGroup` 값 그대로, `STUDENT`면 학생 이름).

### 문제 순서

`questionIds` 배열의 순서가 곧 학생에게 노출되는 풀이 순서입니다. 응답의 `questions[].order`는 1부터 시작하는 순번으로, 배열 인덱스와 1:1 대응합니다. `PATCH`로 `questionIds`를 다시 지정하면 순서를 포함해 전체가 교체됩니다(부분 순서 변경 불가).

---

### GET `/api/assignments` — 과제 목록 조회

**Query Parameters**: `status`(`예정`/`진행 중`/`마감`), `keyword`, `page`, `size`

**Response** `200 OK`
```json
{
  "content": [
    { "id": 1, "title": "현재완료 시제 연습", "targetType": "CLASS", "targetGroup": "중1 A반", "target": "중1 A반", "startDate": "2026-08-03", "dueDate": "2026-08-05", "progress": 84, "status": "진행 중" }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```
`progress`는 제출률(관리자 관점)입니다 — "대상 학생 중 과제를 최종 제출(제출 상태 `SUBMITTED`)한 학생 수 ÷ 전체 대상 학생 수"(정의: [feature-spec.md](feature-spec.md#도메인-용어)). 학생 관점의 `progress`([내 과제](#내-과제-phase-3-mvp-구현-범위) 참고)와 계산 기준이 다르므로 혼동하지 않습니다.

---

### GET `/api/assignments/{id}` — 과제 상세 조회

**Response** `200 OK`
```json
{
  "id": 1,
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "targetGroup": "중1 A반",
  "target": "중1 A반",
  "startDate": "2026-08-03",
  "dueDate": "2026-08-05",
  "status": "진행 중",
  "progress": 84,
  "questions": [
    { "id": 1024, "order": 1, "text": "He has lived here _____ 2010.", "category": "현재완료" }
  ]
}
```
개별 학생 대상인 경우 `targetType: "STUDENT"`, `targetStudentId`(long)가 `targetGroup` 대신 포함됩니다.

**Error**: `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }`

---

### POST `/api/assignments` — 과제 생성

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `title` | string | ✓ | 과제명 |
| `targetType` | string | ✓ | `CLASS` 또는 `STUDENT` |
| `targetGroup` | string | `targetType`이 `CLASS`일 때 ✓ | 반 이름(`Student.studentGroup`과 동일한 값) |
| `targetStudentId` | long | `targetType`이 `STUDENT`일 때 ✓ | 대상 학생 ID |
| `startDate` | date | ✓ | 시작일 (`YYYY-MM-DD`). `dueDate`보다 늦을 수 없음 |
| `dueDate` | date | ✓ | 마감일 (`YYYY-MM-DD`) |
| `questionIds` | long[] | ✓ | 포함할 문제 ID 목록, 순서대로(최소 1개) |

```json
{
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "targetGroup": "중1 A반",
  "startDate": "2026-08-08",
  "dueDate": "2026-08-10",
  "questionIds": [1024, 1023, 1021]
}
```

**Response** `201 Created`, `Location: /api/assignments/{id}`
```json
{
  "id": 4,
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "targetGroup": "중1 A반",
  "target": "중1 A반",
  "startDate": "2026-08-08",
  "dueDate": "2026-08-10",
  "status": "예정",
  "progress": 0
}
```
`status`는 생성 시점의 `startDate`/`dueDate`로 곧바로 계산됩니다 — 위 예시처럼 `startDate`가 미래면 `예정`, 오늘이거나 과거면 `진행 중`입니다(위 [상태 계산 규칙](#상태status-계산-규칙) 참고).

**Error**:
- `400 Bad Request` `{ "code": "INVALID_ASSIGNMENT", "message": "문제를 1개 이상 선택해야 합니다." }` — `questionIds`가 비어 있는 경우
- `400 Bad Request` `{ "code": "INVALID_ASSIGNMENT", "message": "targetType이 CLASS이면 targetGroup이 필수입니다." }` — `targetType`에 대응하는 대상 필드가 누락된 경우(반대 방향도 동일한 코드)
- `400 Bad Request` `{ "code": "INVALID_ASSIGNMENT", "message": "시작일은 마감일보다 늦을 수 없습니다." }` — `startDate > dueDate`인 경우
- `404 Not Found` `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }` — `questionIds` 중 존재하지 않는 문제 ID가 있는 경우
- `404 Not Found` `{ "code": "STUDENT_NOT_FOUND", "message": "학생을 찾을 수 없습니다." }` — `targetStudentId`가 존재하지 않는 경우

---

### PATCH `/api/assignments/{id}` — 과제 수정

**Request Body**: `targetType`+(`targetGroup`|`targetStudentId`), `startDate`, `dueDate`, `questionIds` 중 변경할 항목만 포함. `targetType`을 바꾸는 경우 그에 대응하는 대상 필드도 함께 보내야 합니다. `startDate`/`dueDate` 중 하나만 보내는 경우에도 저장된 값과 합쳐 `startDate ≤ dueDate` 검증을 수행합니다.

```json
{ "dueDate": "2026-08-12" }
```

**Response** `200 OK`: 수정된 과제 상세 (GET 상세 조회와 동일 구조)

**Error**: `404 Not Found`(`ASSIGNMENT_NOT_FOUND`), `400 Bad Request`(`INVALID_ASSIGNMENT`, POST와 동일한 검증 규칙), `409 Conflict` `{ "code": "ASSIGNMENT_ALREADY_CLOSED", "message": "마감된 과제는 수정할 수 없습니다." }` — 현재 상태가 `마감`인 경우(위 자동 계산 규칙 기준)

---

### DELETE `/api/assignments/{id}` — 과제 삭제

**Response** `204 No Content`

**Error**: `404 Not Found`(`ASSIGNMENT_NOT_FOUND`)

---

## 학생 (Student, 관리자 관점)

학생 생성·수정·삭제 API는 없습니다(읽기 전용) — [feature-spec.md](feature-spec.md#4-학생-관리)의 "(향후) 학생 등록 기능은... 구현 대상은 아니다"와 동일하게, 계정은 관리자가 사전에 시딩합니다. 아래 두 엔드포인트만 존재하며, 응답 필드도 동일한 구조를 공유합니다.

> **참고(용어 표기)**: `api-spec.md`는 이 섹션을 요약하며 그룹 필드를 "그룹"/`group`으로 간단히 표기하지만, 실제 응답 필드명은 `Member.studentGroup`과 동일한 `studentGroup`입니다(아래 필드 정의 참고). `GET /api/students`의 `group` 쿼리 파라미터명은 `api-spec.md`와 동일하게 유지합니다 — 요청 파라미터명과 응답 필드명이 다른 것뿐, 같은 값을 가리킵니다.

### GET `/api/students` — 학생 목록 조회

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `keyword` | string | | 학생 이름 부분 일치 검색(포함 검색, 대소문자 무시). 미지정 시 전체 대상 |
| `group` | string | | `studentGroup` 완전 일치 필터. 미지정 시 전체 대상(그룹 미배정 학생도 포함) |
| `page` | int | | 기본값 0 |
| `size` | int | | 기본값 20, 1~100 |

**Response** `200 OK`
```json
{
  "content": [
    { "id": 501, "name": "김민수", "studentGroup": "중1 A반", "lastStudiedAt": "2026-08-01", "totalQuestionCount": 128, "accuracy": 74, "pendingAssignmentCount": 1 }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

**필드 정의** (목록·상세 공통)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | `Member.id` |
| `name` | string | `Member.name` |
| `studentGroup` | string \| null | `Member.studentGroup`. 그룹이 배정되지 않은 학생은 `null`(이 경우 `targetType: CLASS` 과제의 대상이 될 수 없음 — [대상(target) 지정](#대상target-지정) 참고) |
| `lastStudiedAt` | date \| null | 이 학생의 가장 최근 `StudyRecord.submittedAt`을 KST 날짜로 변환한 값(유형 무관, `PRACTICE`+`ASSIGNMENT` 모두 포함). 학습 기록이 하나도 없으면 `null` |
| `totalQuestionCount` | int | 이 학생의 전체 기간 누적 `StudyRecord` 개수(유형 무관). 기록이 없으면 `0` |
| `accuracy` | int | 누적 정답률(%) = `correctCount ÷ totalQuestionCount × 100`(반올림 — `AssignmentSubmissionProgress.percentage()`와 동일하게 `Math.round` 기준). `totalQuestionCount`가 0이면 `0`(0으로 나누지 않음) |
| `pendingAssignmentCount` | int | 아래 [정의](#pendingassignmentcount-정의) 참고 |

#### pendingAssignmentCount 정의

이 학생이 대상인 과제(`targetType: STUDENT`이며 본인이 대상, 또는 `targetType: CLASS`이며 본인의 `studentGroup`과 `targetGroup`이 일치) 중 **상태가 `예정`이 아니고(`진행 중` 또는 `마감`) 이 학생의 제출 상태(`submissionStatus`)가 `SUBMITTED`가 아닌 것의 개수**입니다.

- `마감`된 과제도 포함합니다 — 제출하지 못한 채 마감된 과제도 관리자 입장에서는 여전히 "미제출"이기 때문입니다.
- `예정` 과제는 학생에게 아직 노출되지 않으므로([예정 과제 숨김 규칙](#내-과제-phase-3-mvp-구현-범위) 참고) 집계에서 제외합니다.
- `submissionStatus`가 `NOT_STARTED`(레코드 없음)이거나 `IN_PROGRESS`인 경우 모두 미제출로 집계됩니다.

### GET `/api/students/{id}` — 학생 상세 조회

**Response** `200 OK`: 위 목록 항목과 동일한 필드 구조
```json
{ "id": 501, "name": "김민수", "studentGroup": "중1 A반", "lastStudiedAt": "2026-08-01", "totalQuestionCount": 128, "accuracy": 74, "pendingAssignmentCount": 1 }
```

**Error**: `404 Not Found` `{ "code": "STUDENT_NOT_FOUND", "message": "학생을 찾을 수 없습니다." }` — `id`에 해당하는 회원이 없거나, 존재하더라도 `Member.type`이 `STUDENT`가 아닌 경우(관리자 계정 ID로는 학생 상세를 조회할 수 없음 — [과제 생성 시 `targetStudentId` 검증](#post-apiassignments--과제-생성)과 동일한 원칙)

### 정렬 및 동점 처리

목록은 항상 `name` 오름차순으로 정렬하며, 이름이 같으면 `id` 오름차순으로 동점을 처리합니다(페이지를 넘기는 동안 순서가 흔들리지 않도록 안정 정렬을 보장).

---

## 학습 이력 (StudyRecord)

`type`의 API 쿼리 값과 응답 값은 항상 `ASSIGNMENT`(과제) 또는 `PRACTICE`(자유 학습)입니다. "과제"/"자유 학습"은 화면에 표시하는 한글 라벨일 뿐, API 쿼리·응답 값으로는 사용하지 않습니다.

**Phase 2/3 범위**: Phase 2에서는 `type: "PRACTICE"` 기록만 생성되었고, **Phase 3(MVP)부터 과제 최종 제출 시 과제에 포함된 문제마다(미응답 문제 포함) `type: "ASSIGNMENT"` 기록이 일괄 생성**됩니다(임시 저장 시점이 아니라 최종 제출 시점에 한 번에 생성됨). 아래 두 엔드포인트는 여러 학생/기간에 걸친 일자별 집계(rollup) 조회용입니다. 자유 학습의 제출 건별 상세(스냅샷 포함)는 이 문서의 [자유 학습(Practice)](#자유-학습-practice-phase-2-구현-범위) 절의 `GET /api/me/practice/records`/`GET /api/me/practice/records/{id}`를 사용합니다. `StudyRecord` 자체(스냅샷 필드, 불변성, 재응시 처리)에 대한 정의도 그 절에서, 과제 제출분 고유 규칙은 [내 과제](#내-과제-phase-3-mvp-구현-범위) 절의 "StudyRecord (과제 제출분)"에서 다룹니다. 과제의 제출 건별 상세(문제별 정답·해설·정오 여부)는 제출 후 [`GET /api/me/assignments/{assignmentId}/result`](#get-apimeassignmentsassignmentidresult--최종-제출-결과-조회)로 확인합니다 — 자유 학습의 `GET /api/me/practice/records/{id}`에 대응하는 과제용 엔드포인트이며, 몇 번이든 재조회할 수 있습니다. 다만 이 엔드포인트는 과제 1건의 최종 결과만 반환하므로, 여러 과제/기간을 한 화면에서 훑어보는 이력은 여전히 위 두 rollup 엔드포인트로 확인합니다.

### 공통 규칙 (일자별 집계)

아래 두 rollup 엔드포인트(`GET /api/study-records`, `GET /api/me/history`)의 일자별 집계는 다음 규칙을 공유합니다.

- **KST 기준 일자 경계**: "일자"(`date`)는 `StudyRecord.submittedAt`을 `Asia/Seoul`(KST, UTC+9)로 변환한 뒤 날짜만 취한 값입니다. 하루의 경계는 KST `00:00:00`(포함)부터 다음날 `00:00:00`(제외)까지입니다. 서버의 기본 타임존 설정(`ClockConfig`의 `Clock.systemDefaultZone()`, 오늘 날짜가 KST가 아닌 다른 타임존으로 배포될 가능성)과 무관하게, 이 변환은 항상 명시적으로 `Asia/Seoul`을 지정해 수행해야 합니다 — 서버 배포 환경의 기본 타임존에 결과가 좌우되지 않도록 하기 위함입니다.
- **집계 그룹화**: `(studentId, date, type)` 조합마다 한 행을 만듭니다. 같은 학생이 같은 날 같은 유형으로 여러 건 풀었다면 하나의 행으로 합산됩니다. 해당 조합에 `StudyRecord`가 1건도 없으면 그 행 자체가 생성되지 않습니다(0건짜리 빈 행을 채워 넣지 않음 — 목록에 없는 날짜는 "그날 활동 없음"으로 해석).
- `questionCount`: 그 그룹의 `StudyRecord` 개수.
- `correctCount`: 그 그룹 중 `correct: true`인 개수.
- `accuracy`: `correctCount ÷ questionCount × 100`(반올림). 그룹은 `questionCount ≥ 1`일 때만 생성되므로 0으로 나누는 경우가 없습니다.
- **`durationMinutes`는 항상 `0`을 반환합니다.** 학습 소요 시간을 신뢰성 있게 측정할 데이터 소스가 현재 없습니다 — `StudyRecord`는 제출 시각(`submittedAt`)만 저장하고 시작 시각을 저장하지 않으며(자유 학습은 "문제 조회"~"제출" 간격이 실제 풀이 시간과 다를 수 있고, 과제는 여러 문제를 오가며 임시 저장하므로 어느 구간을 "소요 시간"으로 볼지 정의할 수 없음), `AssignmentSubmission`도 생성 시각(`createdAt`)·제출 시각(`submittedAt`)만 가질 뿐 학생이 실제로 화면에 머문 시간과는 무관합니다. 클라이언트 하트비트, 문제별 소요 시간 기록 등 실제 체류 시간 트래킹이 도입되기 전까지는 `0`을 반환하며, 위 필드들로부터 값을 추정해 채우지 않습니다(신뢰할 수 없는 값을 노출하는 것보다 미지원임을 명시하는 편이 낫다는 판단 — 향후 시간 트래킹이 추가되면 이 규칙과 필드 설명을 갱신합니다).

### GET `/api/study-records` — 학습 이력 조회 (관리자용)

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `studentId` | long | | 특정 학생으로 필터. 미지정 시 전체 학생 대상 |
| `period` | string | | `7d`(최근 7일, 오늘 포함) 또는 `30d`(최근 30일, 오늘 포함). 미지정 시 `30d`로 간주 |
| `type` | string | | `ASSIGNMENT` 또는 `PRACTICE`. 미지정 시 두 유형 모두 포함 |
| `page` | int | | 기본값 0 |
| `size` | int | | 기본값 20, 1~100 |

`period`의 "최근 N일"은 KST 오늘부터 `N-1`일 전까지(오늘 포함)를 뜻합니다 — 예를 들어 오늘이 KST `2026-08-18`이면 `7d`는 `2026-08-12`~`2026-08-18`입니다.

**Response** `200 OK`
```json
{
  "content": [
    { "studentId": 501, "studentName": "김민수", "date": "2026-08-01", "type": "ASSIGNMENT", "questionCount": 20, "correctCount": 16, "accuracy": 80, "durationMinutes": 0 }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```
`content`는 `date` 내림차순(최신 먼저)으로 정렬하며, 같은 날짜 내에서는 `studentId` 오름차순, 같은 학생 내에서는 `type` 오름차순(`ASSIGNMENT` < `PRACTICE`, 문자열 기준)으로 동점을 처리합니다.

**Error**:
- `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }` — `period`가 `7d`/`30d`가 아니거나, `type`이 `ASSIGNMENT`/`PRACTICE`가 아니거나, `page`/`size`가 허용 범위를 벗어난 경우
- `404 Not Found` `{ "code": "STUDENT_NOT_FOUND", "message": "학생을 찾을 수 없습니다." }` — `studentId`에 해당하는 회원이 없거나, 존재하더라도 학생이 아닌 경우

### GET `/api/me/history` — 내 학습 이력 조회 (학생 본인)

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `period` | string | | `7d`/`30d`. 미지정 시 `30d` |
| `type` | string | | `ASSIGNMENT`/`PRACTICE`. 미지정 시 전체 |

**Response** `200 OK`
```json
{
  "summary": {
    "totalSolved": 342,
    "cumulativeAccuracy": 74,
    "totalStudyMinutes": 0
  },
  "byCategory": [
    { "category": "가정법", "accuracy": 45, "questionCount": 12 },
    { "category": "현재완료", "accuracy": 82, "questionCount": 60 }
  ],
  "records": [
    { "date": "2026-08-01", "type": "ASSIGNMENT", "questionCount": 20, "correctCount": 16, "accuracy": 80, "durationMinutes": 0 }
  ]
}
```

**필드 정의**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `summary.totalSolved` | int | **`period`/`type` 쿼리와 무관하게 항상 전체 기간·전체 유형 누적** `StudyRecord` 개수(지표 카드는 "누적" 값이므로). 기록이 없으면 `0` |
| `summary.cumulativeAccuracy` | int | 전체 기간·전체 유형 누적 정답률(%), 반올림. `totalSolved`가 0이면 `0` |
| `summary.totalStudyMinutes` | int | 항상 `0` — 위 [공통 규칙](#공통-규칙-일자별-집계)의 `durationMinutes`와 동일한 이유로 신뢰 가능한 소요 시간 데이터가 없습니다 |
| `byCategory[].category` | string | `StudyRecord.category` 스냅샷 기준, 전체 기간·전체 유형 누적(`period`/`type` 필터 무관) |
| `byCategory[].accuracy` | int | 그 문법 항목의 누적 정답률(%), 반올림 |
| `byCategory[].questionCount` | int | 그 문법 항목의 누적 풀이 수(표본 크기 — 정답률의 신뢰도를 함께 보여주기 위함) |
| `records[]` | array | 위 [공통 규칙](#공통-규칙-일자별-집계)과 동일한 KST 일자별 집계이며 `period`/`type` 쿼리로 필터링됩니다. 본인 기록만 대상이므로 `studentId`/`studentName`은 포함하지 않습니다 |

`byCategory`는 정답률 오름차순(취약한 항목 먼저)으로 정렬하며 동점 시 `category` 오름차순, `records`는 `date` 내림차순이며 동점 시 `type` 오름차순으로 처리합니다.

이전 초안에 있던 `summary.resolvedWrongAnswers` 필드는 이 문서에서 제거합니다 — 오답노트(WrongAnswer)의 복습 상태 추적 자체가 [Phase 5 범위 밖](#오답노트-wronganswer)이라 계산할 데이터가 없습니다. Phase 5에서 오답노트를 구현하면 이 필드를 다시 추가합니다.

**Error**: `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }` — `period`/`type`이 허용된 값이 아닌 경우

---

## 성능 고려사항 (Student, StudyRecord, 대시보드 공통)

`/api/students`, `/api/study-records`, `/api/me/history`, `/api/dashboard/admin`, `/api/me/dashboard`는 모두 `Member`/`StudyRecord`/`Assignment`/`AssignmentSubmission`을 다양한 조건으로 집계합니다. 큰 아키텍처 변경 없이 아래 인덱스만 추가해도 대부분의 쿼리를 커버할 수 있습니다(정확한 컬럼명·테이블명은 구현 시 실제 스키마에 맞춰 조정):

- `study_record(member_id, submitted_at)`: 학생별 `lastStudiedAt`, 학생별 오늘 활동 여부, 기간 필터(`7d`/`30d`) 쿼리
- `study_record(type, submitted_at)`: `studentId` 없이 전체 학생을 대상으로 하는 `todayActiveStudents`, `weeklyStudyVolume`, `GET /api/study-records`(전체 학생 조회) 쿼리
- `study_record(category)`: `accuracyByCategory`/`weakCategories`/`byCategory` 집계(카테고리별 `GROUP BY`)
- `member(type, student_group)`: 이미 `MemberReader.countByTypeAndStudentGroup`이 사용 중인 조합과 동일 — 학생 목록의 `group` 필터, 과제 대상 인원 수 계산에 재사용
- `assignment(target_group)`, `assignment(target_student_id)`: 학생별 대상 과제 조회(`pendingAssignmentCount`, `incompleteAssignments`)
- `assignment_submission(student_id, status)`: 학생별 미제출 과제 집계(`pendingAssignmentCount`, `incompleteAssignmentCount`)
- `assignment_submission(assignment_id, status)`: 과제별 제출 현황 집계(`unsubmittedCount`, `unsubmittedAlerts`, 기존 관리자 과제 목록의 `progress`) — `(assignment_id, student_id)` 유니크 제약과는 별개로 `status` 필터 전용 인덱스가 추가로 필요합니다

`keyword`(학생 이름 부분 일치)는 `LIKE '%...%'` 검색이라 일반 B-tree 인덱스로 최적화되지 않습니다. 현재 규모(학생 수백 명 단위)에서는 풀스캔으로도 충분하다고 가정하며, 규모가 커지면 트라이그램(`pg_trgm`) 인덱스 등을 별도로 검토합니다(이 문서의 범위 밖).

---

## 대시보드

### 공통 규칙

- "오늘"은 KST(Asia/Seoul) 기준 날짜입니다(위 [학습 이력 공통 규칙](#공통-규칙-일자별-집계)과 동일한 변환 규칙을 사용).
- 두 대시보드 모두 여러 테이블을 조인·집계하는 무거운 쿼리이므로, 캐싱 여부는 이 문서의 범위 밖입니다(구현 시 필요하면 별도 논의).

### GET `/api/dashboard/admin` — 관리자 대시보드

**Response** `200 OK`
```json
{
  "totalStudents": 128,
  "todayActiveStudents": 45,
  "assignmentStatusCounts": { "예정": 3, "진행 중": 8, "마감": 21 },
  "unsubmittedCount": 23,
  "weeklyStudyVolume": [
    { "date": "2026-08-12", "day": "수", "value": 46 },
    { "date": "2026-08-13", "day": "목", "value": 61 }
  ],
  "accuracyByCategory": [
    { "category": "가정법", "accuracy": 45, "questionCount": 80 },
    { "category": "시제", "accuracy": 82, "questionCount": 210 }
  ],
  "unsubmittedAlerts": [
    { "studentId": 501, "studentName": "김민수", "assignmentId": 4, "assignmentTitle": "현재완료 시제 연습", "dueDate": "2026-08-22", "note": "마감 D-4" }
  ]
}
```

**필드 정의**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `totalStudents` | int | `Member.type = STUDENT`인 전체 회원 수 |
| `todayActiveStudents` | int | 오늘(KST) `StudyRecord`(유형 무관)를 1건 이상 제출한 서로 다른 학생 수(distinct) |
| `assignmentStatusCounts` | object | 전체 과제를 [상태 계산 규칙](#상태status-계산-규칙)으로 분류한 개수. 키는 `"예정"`/`"진행 중"`/`"마감"` 3개로 고정이며, 값이 0이어도 키는 항상 포함됩니다 |
| `unsubmittedCount` | int | 상태가 `진행 중` 또는 `마감`인 과제 전체에 대해, 그 과제의 대상 학생 중 제출 상태가 `SUBMITTED`가 아닌 **(학생, 과제) 조합의 총 개수**를 합산한 값입니다(과제 개수가 아니라 미제출 건수의 합 — 과제별로 "대상 학생 수 − 제출 완료 학생 수"를 구해 더한 것과 같으며, [`GET /api/assignments`의 `progress`(관리자 관점 제출률)](#get-apiassignments--과제-목록-조회) 계산에 쓰이는 대상 학생 수·제출 완료 수를 그대로 재사용할 수 있습니다). `targetType: CLASS`인데 대상 그룹에 학생이 0명이면 그 과제는 0건으로 집계됩니다(음수가 되지 않음) |
| `weeklyStudyVolume[]` | array | 오늘(KST)을 포함한 최근 7일, 날짜 오름차순 고정 7개 항목. **활동이 없는 날도 `value: 0`으로 채워 넣습니다**(그래프 X축 연속성을 위해 — 위 학습 이력 rollup의 "빈 날짜는 행을 생성하지 않는다" 규칙과는 다른 규칙이므로 혼동 주의). `value`는 그날 전체 학생의 `StudyRecord`(유형 무관) 총 개수. `day`는 요일 한 글자(`월`~`일`), `date`(`YYYY-MM-DD`)를 함께 제공해 여러 주에 걸친 같은 요일을 구분할 수 있게 합니다 |
| `accuracyByCategory[]` | array | `StudyRecord.category` 스냅샷 기준 전체 학생·전체 기간 누적 집계. 정답률 오름차순(취약 항목 먼저), 동점 시 `category` 오름차순. 학습 기록이 아예 없는 카테고리(표본 0)는 목록에 나타나지 않습니다 |
| `unsubmittedAlerts[]` | array | 아래 설명 참고 |

**`unsubmittedAlerts` 정의**: 상태가 **`진행 중`인 과제만** 대상입니다(아직 마감 전이라 조치 가능한 것만 알림으로 노출 — 이미 `마감`된 과제는 알림이 아니라 위 `unsubmittedCount`나 학습 이력 조회로 확인). 그 과제들 중 제출 상태가 `SUBMITTED`가 아닌 (학생, 과제) 조합을 `dueDate` 오름차순(마감 임박 순)으로 정렬하고, 동점 시 `studentId` 오름차순, 그다음 `assignmentId` 오름차순으로 처리합니다. **최대 20건**으로 제한합니다(대시보드 위젯이므로 페이지네이션은 제공하지 않음 — 전체 목록이 필요하면 `GET /api/study-records`와 `GET /api/assignments`를 조합해 확인). `note`는 `"마감 D-{일수}"` 형식이며, 오늘(KST)과 `dueDate`의 일수 차이로 계산합니다(예: 오늘이 `dueDate`인 경우 `"마감 D-0"`).

**Error**: 없음(인증/인가 오류 제외)

### GET `/api/me/dashboard` — 학생 대시보드

**Response** `200 OK`
```json
{
  "todaySolvedCount": 12,
  "todayAccuracy": 75,
  "todayStudyMinutes": 0,
  "incompleteAssignmentCount": 2,
  "incompleteAssignments": [
    { "assignmentId": 4, "title": "현재완료 시제 연습", "dueDate": "2026-08-22", "progress": 40, "submissionStatus": "IN_PROGRESS" }
  ],
  "weakCategories": [
    { "category": "가정법", "accuracy": 45, "questionCount": 12 }
  ]
}
```

**필드 정의**

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `todaySolvedCount` | int | 오늘(KST) 이 학생이 제출한 `StudyRecord`(유형 무관, `PRACTICE`+`ASSIGNMENT`) 개수 |
| `todayAccuracy` | int | 오늘 정답률(%), 반올림. `todaySolvedCount`가 0이면 `0` |
| `todayStudyMinutes` | int | 항상 `0` — 위 [학습 이력 공통 규칙](#공통-규칙-일자별-집계)과 동일한 이유로 미지원 |
| `incompleteAssignmentCount` | int | `GET /api/me/assignments` 목록에 나타나는 과제(상태가 `예정`이 아닌 것) 중 `submissionStatus`가 `SUBMITTED`가 아닌 개수입니다. `마감`된 미제출 과제도 포함합니다(그 목록에서 사라지지 않으므로) |
| `incompleteAssignments[]` | array | 위와 같은 조건의 과제 요약. `dueDate` 오름차순, 최대 5건(전체 목록은 `GET /api/me/assignments` 참고). `progress`는 [학생 관점 진행률](#내-과제-phase-3-mvp-구현-범위) 계산과 동일합니다 |
| `weakCategories[]` | array | 아래 [최소 표본 규칙](#weakcategories-최소-표본-규칙) 참고 |

#### weakCategories 최소 표본 규칙

이 학생의 `StudyRecord`(유형 무관, 전체 기간 누적)를 `category` 스냅샷으로 그룹화해 정답률을 계산한 뒤, **해당 카테고리의 `questionCount`(누적 풀이 수)가 3 이상인 항목만** 정답률 오름차순으로 최대 3개(TOP3) 반환합니다. 동점 시 `category` 오름차순으로 처리합니다.

- **MVP 기본값입니다.** 표본이 1~2건인 카테고리를 "취약"으로 단정하면 단 한 번의 실수(또는 우연한 정답)로 카테고리가 왜곡되어 표시될 수 있어, 최소 표본 3을 임계값으로 선택했습니다. 데이터가 쌓인 뒤(예: 학생 1인당 평균 풀이 수 기준) 조정 가능한 설정값으로 두는 것을 권장하며, 하드코딩된 값으로 구현하더라도 값이 바뀌면 이 문서를 갱신해야 합니다.
- 임계값을 넘는 카테고리가 3개 미만이면 그만큼만 반환합니다(예: 1개만 조건을 만족하면 배열 길이 1). 하나도 만족하지 않으면 **빈 배열**을 반환합니다(임계값을 낮춰서 억지로 채우지 않음).
- 이 목록은 **읽기 전용 집계**입니다 — 추천 로직(예: "이 카테고리를 더 풀어보세요" 문제 자동 배정)은 포함하지 않으며, [오답노트/재응시/추천 API](#오답노트-wronganswer)와 마찬가지로 Phase 5 범위입니다. 여기서는 이미 존재하는 `StudyRecord`를 집계해 보여주기만 합니다.

**Error**: 없음(인증/인가 오류 제외)

---

## 내 과제 / 문제 풀이 (학생)

**Phase 2/3 구현 범위**: 이 문서 중 [자유 학습(Practice)](#자유-학습-practice-phase-2-구현-범위) 절은 Phase 2에서, 아래 **내 과제** 절은 Phase 3(MVP)에서 구현합니다. `/api/me/**`이므로 `ROLE_STUDENT`만 접근할 수 있고, 학생 식별은 항상 access token의 `memberId`(subject)로부터 얻습니다([공통 규칙](#공통-규칙) 참고).

### 내 과제 (Phase 3 MVP 구현 범위)

과제 수행은 CBT(컴퓨터 기반 시험) 방식입니다. 문제마다 즉시 채점하는 자유 학습과 달리, 학생은 문제별 답안을 **임시 저장**만 하고 정답·해설·정오 여부·점수는 학생이 **최종 제출**을 호출한 순간에만 한 번에 계산되어 노출됩니다. 그 전까지는 어떤 응답에도 채점 관련 정보가 포함되지 않습니다. 제출 이후에는 [`GET .../result`](#get-apimeassignmentsassignmentidresult--최종-제출-결과-조회)로 동일한 채점 결과를 새로고침·재방문 등 몇 번이든 다시 조회할 수 있습니다(불변 스냅샷 기반이므로 재채점하지 않음).

**대상 판정**: 학생이 접근 가능한 과제는 `targetType: STUDENT`이며 `targetStudentId`가 본인인 과제, 또는 `targetType: CLASS`이며 `targetGroup`이 본인의 `Student.studentGroup`과 같은 과제입니다. 그 외 과제에 대한 조회·저장·제출은 존재하지 않는 것과 동일하게 `404 Not Found`(`ASSIGNMENT_NOT_FOUND`)를 반환합니다(관리자 전용 자원 존재 여부를 노출하지 않기 위함 — [자유 학습 기록 상세](#get-apimepracticerecordsid--내-자유-학습-기록-상세)의 `404` 사용 방식과 동일한 원칙).

**예정 과제 숨김 규칙**: 위 대상 판정을 통과하더라도, 과제 상태가 `예정`(오늘 `<` `startDate`)이면 아래 세 엔드포인트 모두 대상이 아닌 과제와 동일하게 `404 Not Found`(`ASSIGNMENT_NOT_FOUND`)를 반환하며, `GET /api/me/assignments` 목록에도 나타나지 않습니다. 시작일이 지나 상태가 `진행 중`으로 바뀌는 순간부터 정상적으로 노출·접근됩니다.

**제출 상태(submissionStatus)와 생명주기**

- 학생 1명 × 과제 1건마다 제출 상태를 가지며, 아직 `GET .../questions`를 한 번도 호출하지 않았다면 서버에 레코드가 없는 `NOT_STARTED`입니다(목록 응답에서만 나타나는 계산값이며, 실제로는 "레코드 없음"과 동일합니다).
- `GET /api/me/assignments/{assignmentId}/questions`를 처음 호출하면 그 시점에 제출 상태가 `IN_PROGRESS`로 생성됩니다("시작하기"). 이미 `IN_PROGRESS`인 상태에서 다시 호출하면 기존 레코드와 임시 저장 값을 그대로 반환합니다("이어서 풀기") — 두 버튼은 동일한 엔드포인트 호출입니다.
- `IN_PROGRESS`인 동안에는 [`PUT .../answers/{questionId}`](#put-apimeassignmentsassignmentidanswersquestionid--답안-임시-저장)로 답안을 자유롭게 저장·수정할 수 있습니다.
- [`POST .../submit`](#post-apimeassignmentsassignmentidsubmit--최종-제출)을 호출하면 `SUBMITTED`로 전이되며 이후 되돌릴 수 없습니다. `SUBMITTED` 상태에서는 임시 저장(`PUT .../answers/{questionId}`)과 재제출(`POST .../submit`) 모두 `409 Conflict`로 거부됩니다.
- 마감(`status: 마감`, `dueDate` 경과)된 과제는 제출 상태와 무관하게 임시 저장·최종 제출이 모두 `409 Conflict`(`ASSIGNMENT_CLOSED`)로 거부됩니다.

**StudyRecord (과제 제출분) 및 채점 트랜잭션**

- StudyRecord는 답안을 임시 저장할 때가 아니라 **최종 제출 시점에 한 번에** 생성됩니다. 그 시점까지 임시 저장되어 있던 문제마다 1건씩 생성되며(`type: ASSIGNMENT`), 자유 학습분과 동일하게 **불변**입니다(수정·삭제 API 없음).
- 생성 시점에 원본 `Question`의 `category`/`level`/`text`/`choices`/`answer`(정답)/`explanation`을 스냅샷으로 저장합니다. 이후 관리자가 문제를 수정하거나 상태를 변경해도 이미 생성된 기록의 스냅샷은 바뀌지 않습니다 — [자유 학습 StudyRecord](#자유-학습-practice-phase-2-구현-범위)와 동일한 규칙입니다.
- 과제 제출분은 추가로 **제출 대상 과제에 대한 참조**를 함께 저장합니다(진행률·이력 집계에 내부적으로 사용되며, 제출 응답 필드로 별도 노출하지는 않습니다).
- **원자성**: "임시 저장된 모든 답안 채점 + 문제별 StudyRecord 일괄 생성 + 제출 상태를 `SUBMITTED`로 전이"는 하나의 DB 트랜잭션으로 처리됩니다. 트랜잭션 도중 오류가 발생하면 전부 롤백되어 StudyRecord가 일부만 생성되거나 제출 상태만 바뀌는 상태는 발생하지 않습니다(부분 성공 없음).
- **중복 제출 방지**: 제출 상태를 `IN_PROGRESS` → `SUBMITTED`로 바꾸는 갱신은 조건부 갱신(현재 상태가 `IN_PROGRESS`일 때만 성공)으로 수행됩니다. 동시에 두 번 제출 요청이 들어와도 하나만 성공하고 트랜잭션이 커밋되며, 나머지 요청은 `409 Conflict`(`ASSIGNMENT_ALREADY_SUBMITTED`)를 받습니다 — StudyRecord가 중복 생성되는 경우는 없습니다.
- **과제에 포함된 모든 문제마다 StudyRecord가 정확히 1건씩 생성됩니다** — 임시 저장이 없던 문제(한 번도 저장하지 않고 최종 제출한 경우)도 예외 없이 포함됩니다. 이 경우 `submittedAnswer: null`, `correct: false`로 스냅샷과 함께 기록됩니다. 미응답 문제까지 빠짐없이 기록해야 제출 시점의 전체 결과를(문제 수 포함) 이후 [`GET .../result`](#get-apimeassignmentsassignmentidresult--최종-제출-결과-조회)로 원본 `Question`이 수정·상태 변경되어도 그대로 재구성할 수 있습니다.
- **구현 유의(nullable `submittedAnswer`)**: 자유 학습분(Practice) StudyRecord의 `submittedAnswer`는 제출 시 `answer`가 필수이므로 항상 값이 있는 문자열이지만, 과제 제출분(Assignment)은 미응답 문제의 스냅샷을 위해 `submittedAnswer`가 `null`일 수 있어야 합니다. 자유 학습 쪽의 "제출 시 `answer` 필수" 검증([자유 학습 StudyRecord](#자유-학습-practice-phase-2-구현-범위) 참고)은 이 변경과 무관하게 그대로 유지됩니다 — 두 학습 유형의 검증 규칙이 서로 다름을 구현 시 유의해야 합니다.
- **진행률 계산(임시 저장 기준, 최종 제출 전)**: 학생의 특정 과제 진행률(%) = "이 학생이 그 과제의 문제 중 임시 저장한 답안이 있는 **서로 다른 `questionId`** 수 ÷ 과제의 전체 문제 수 × 100". 채점 여부·정답 여부와는 무관합니다(최종 제출 전에는 애초에 채점 자체가 이루어지지 않으므로).
- `type`은 항상 `ASSIGNMENT`입니다. 이 값은 `GET /api/study-records`(관리자)와 `GET /api/me/history`(학생 본인)의 rollup 집계에도 반영됩니다.

---

#### GET `/api/me/assignments` — 내 과제 목록

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `page` | int | | 기본값 0 |
| `size` | int | | 기본값 20 |

**Response** `200 OK`
```json
{
  "content": [
    { "id": 1, "title": "현재완료 시제 연습", "startDate": "2026-08-03", "dueDate": "2026-08-05", "status": "진행 중", "submissionStatus": "IN_PROGRESS", "progress": 40 }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```
`progress`는 이 학생의 진행률(%)이며, 위 "StudyRecord (과제 제출분) 및 채점 트랜잭션"의 계산 방식(임시 저장 기준)을 따릅니다. `submissionStatus`는 `NOT_STARTED`/`IN_PROGRESS`/`SUBMITTED` 중 하나입니다. 상태가 `예정`인 과제는 이 목록에 나타나지 않습니다(위 예정 과제 숨김 규칙 참고). 마감일 오름차순으로 정렬합니다.

---

#### GET `/api/me/assignments/{assignmentId}/questions` — 과제 문제 목록 (풀이용, 시작/재개)

이 엔드포인트를 처음 호출하는 시점에 제출 상태(submissionStatus)가 `IN_PROGRESS`로 생성됩니다("시작하기"). 이미 시작한 뒤 다시 호출하면 저장된 임시 답안과 함께 그대로 조회됩니다("이어서 풀기"). 정답·해설·정오 여부는 제출 상태와 무관하게 이 응답에 절대 포함되지 않습니다.

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `assignmentId` | long | |
| `submissionStatus` | string | `IN_PROGRESS` 또는 `SUBMITTED` (이 엔드포인트 호출 시점에 `NOT_STARTED`는 항상 `IN_PROGRESS`로 생성되므로 나타나지 않음) |
| `questions[].id` | long | 문제 ID |
| `questions[].order` | int | 풀이 순서(1부터 시작, 과제 생성/수정 시 지정한 `questionIds` 순서) |
| `questions[].category` | string | |
| `questions[].level` | string | |
| `questions[].text` | string | |
| `questions[].choices` | string[] | |
| `questions[].myAnswer` | string \| null | 이 학생이 임시 저장한 답(없으면 `null`). 정답 여부는 포함하지 않음 |

```json
{
  "assignmentId": 1,
  "submissionStatus": "IN_PROGRESS",
  "questions": [
    { "id": 1024, "order": 1, "category": "현재완료", "level": "보통", "text": "He has lived here _____ 2010.", "choices": ["for", "since", "during", "from"], "myAnswer": "since" },
    { "id": 1023, "order": 2, "category": "현재완료", "level": "보통", "text": "...", "choices": ["for", "since", "during", "from"], "myAnswer": null }
  ]
}
```
"이어서 풀기"는 `myAnswer: null`인 첫 문제(가장 작은 `order`)로 이동하는 방식으로 클라이언트가 구현합니다. `submissionStatus: SUBMITTED`인 과제도 조회는 가능하지만(제출한 답안을 다시 보고 싶을 때), 이 응답에는 여전히 정답·해설·정오 여부가 포함되지 않습니다 — 채점 결과는 이 엔드포인트가 아니라 [`GET .../result`](#get-apimeassignmentsassignmentidresult--최종-제출-결과-조회)로 확인하며, 제출 후 몇 번이든 재조회할 수 있습니다.

**Error**: `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }` — 존재하지 않거나, 본인이 대상이 아니거나, 상태가 `예정`인 과제

---

#### PUT `/api/me/assignments/{assignmentId}/answers/{questionId}` — 답안 임시 저장

**Path Parameters**: `assignmentId`(long), `questionId`(long, 과제에 포함된 문제 ID)

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `answer` | string | ✓ | 임시 저장할 답 |

```json
{ "answer": "since" }
```

채점하지 않고 저장만 합니다. 같은 `questionId`로 다시 호출하면 이전 임시 저장 값을 덮어씁니다(upsert) — 자유 학습의 재응시처럼 여러 건이 쌓이지 않습니다. `GET .../questions`를 아직 호출하지 않아 제출 상태가 없는 경우, 이 호출이 먼저 제출 상태를 `IN_PROGRESS`로 생성합니다.

**Response** `200 OK`
```json
{ "questionId": 1024, "answer": "since", "savedAt": "2026-08-15T10:00:00" }
```
정답 여부·정답·해설은 포함하지 않습니다.

**Error**:
- `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }` — `answer` 누락 또는 형식 오류
- `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }` — 존재하지 않거나, 본인이 대상이 아니거나, 상태가 `예정`인 과제
- `404 Not Found` `{ "code": "QUESTION_NOT_IN_ASSIGNMENT", "message": "과제에 포함되지 않은 문제입니다." }` — `questionId`가 이 과제의 문제 목록에 없는 경우
- `409 Conflict` `{ "code": "ASSIGNMENT_CLOSED", "message": "마감된 과제에는 답안을 저장할 수 없습니다." }` — 과제 상태가 `마감`인 경우
- `409 Conflict` `{ "code": "ASSIGNMENT_ALREADY_SUBMITTED", "message": "이미 제출된 과제는 답안을 수정할 수 없습니다." }` — 제출 상태가 `SUBMITTED`인 경우

---

#### POST `/api/me/assignments/{assignmentId}/submit` — 최종 제출

**Request Body**: 없음

그 시점까지 임시 저장된 모든 답안을 한 번에 채점하고, 문제별 `ASSIGNMENT` StudyRecord를 일괄 생성하며 제출 상태를 `SUBMITTED`로 전이합니다. 전체 처리는 하나의 트랜잭션이며(위 "StudyRecord (과제 제출분) 및 채점 트랜잭션"의 원자성·중복 제출 방지 규칙 참고), 성공 시에만 커밋되고 실패 시 전부 롤백됩니다(부분 채점·부분 StudyRecord 생성 없음).

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `assignmentId` | long | |
| `submissionStatus` | string | 항상 `"SUBMITTED"` |
| `submittedAt` | datetime | |
| `totalQuestions` | int | 과제의 전체 문제 수 |
| `answeredQuestions` | int | 최종 제출 시점에 임시 저장되어 있던 문제 수 |
| `correctCount` | int | 정답 문제 수 |
| `score` | int | `correctCount ÷ totalQuestions × 100`(반올림) |
| `results[].questionId` | long | |
| `results[].submittedAnswer` | string \| null | 임시 저장이 없던 문제는 `null` |
| `results[].correct` | boolean | 임시 저장이 없던 문제는 `false` |
| `results[].correctAnswer` | string | 문제의 정답(스냅샷) |
| `results[].explanation` | string | 문제의 해설(스냅샷) |

```json
{
  "assignmentId": 1,
  "submissionStatus": "SUBMITTED",
  "submittedAt": "2026-08-15T10:00:00",
  "totalQuestions": 3,
  "answeredQuestions": 2,
  "correctCount": 1,
  "score": 33,
  "results": [
    { "questionId": 1024, "submittedAnswer": "since", "correct": true, "correctAnswer": "since", "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다." },
    { "questionId": 1023, "submittedAnswer": "for", "correct": false, "correctAnswer": "since", "explanation": "..." },
    { "questionId": 1021, "submittedAnswer": null, "correct": false, "correctAnswer": "were", "explanation": "..." }
  ]
}
```

**Error**:
- `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }` — 존재하지 않거나, 본인이 대상이 아니거나, 상태가 `예정`인 과제
- `409 Conflict` `{ "code": "ASSIGNMENT_CLOSED", "message": "마감된 과제는 제출할 수 없습니다." }` — 과제 상태가 `마감`인 경우
- `409 Conflict` `{ "code": "ASSIGNMENT_ALREADY_SUBMITTED", "message": "이미 제출된 과제입니다." }` — 제출 상태가 이미 `SUBMITTED`인 경우(재채점하지 않고 거부; 기존 결과는 [`GET .../result`](#get-apimeassignmentsassignmentidresult--최종-제출-결과-조회)로 조회)

---

#### GET `/api/me/assignments/{assignmentId}/result` — 최종 제출 결과 조회

제출 상태가 `SUBMITTED`인 과제에 한해, 최종 제출 시 채점되어 저장된 결과를 몇 번이든 다시 조회할 수 있는 엔드포인트입니다. 새로고침이나 이후 재방문에서도 동일한 채점 결과를 안전하게 재구성할 수 있도록 하기 위한 것으로, 재채점하지 않고 제출 시점에 생성된 `ASSIGNMENT` StudyRecord 스냅샷을 그대로 조합해 반환합니다(원본 `Question`이 이후 수정·삭제되어도 영향 없음).

**Response** `200 OK`: [`POST .../submit`](#post-apimeassignmentsassignmentidsubmit--최종-제출)의 성공 응답과 완전히 동일한 필드 구조(`assignmentId`, `submissionStatus`, `submittedAt`, `totalQuestions`, `answeredQuestions`, `correctCount`, `score`, `results[]`)입니다. `results`에는 미응답 문제도 `submittedAnswer: null`, `correct: false`로 포함됩니다.

```json
{
  "assignmentId": 1,
  "submissionStatus": "SUBMITTED",
  "submittedAt": "2026-08-15T10:00:00",
  "totalQuestions": 3,
  "answeredQuestions": 2,
  "correctCount": 1,
  "score": 33,
  "results": [
    { "questionId": 1024, "submittedAnswer": "since", "correct": true, "correctAnswer": "since", "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다." },
    { "questionId": 1023, "submittedAnswer": "for", "correct": false, "correctAnswer": "since", "explanation": "..." },
    { "questionId": 1021, "submittedAnswer": null, "correct": false, "correctAnswer": "were", "explanation": "..." }
  ]
}
```

**Error**:
- `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }` — 존재하지 않거나, 본인이 대상이 아니거나, 상태가 `예정`인 과제(대상 판정이 제출 여부보다 먼저 적용됨)
- `409 Conflict` `{ "code": "ASSIGNMENT_NOT_SUBMITTED", "message": "아직 제출하지 않은 과제입니다." }` — 제출 상태가 `NOT_STARTED` 또는 `IN_PROGRESS`인 경우. 채점 결과·정답·해설·점수 등 어떤 필드도 응답에 포함하지 않습니다(임시 저장 중인 답안을 이 엔드포인트로 들여다볼 수 없도록 함).

---

#### 인수 테스트 시나리오 (Acceptance Examples)

문제 데이터는 위 예시(`id: 1024`, 정답 `since`; `id: 1023`, 정답 `since`; `id: 1021`, 정답 `were`)를 사용하며, `assignmentId: 1`은 `targetType: STUDENT`, `targetStudentId`가 조회하는 학생 본인이고 `status: 진행 중`(시작일이 이미 지난)인 과제입니다.

| # | 시나리오 | 요청 | 기대 결과 |
| --- | --- | --- | --- |
| 1 | 내 과제 목록 조회 | `GET /api/me/assignments` | `200`, 본인이 대상이고 상태가 `예정`이 아닌 과제만 포함, 각 항목에 `progress`(임시 저장 기준)와 `submissionStatus` |
| 2 | 과제 시작(문제 목록 최초 조회) | `GET /api/me/assignments/1/questions` | `200`, `submissionStatus: IN_PROGRESS`로 생성, 전체 문제 `myAnswer: null` |
| 3 | 제출 전 결과 조회 시도 | 2번 이후 `GET /api/me/assignments/1/result` | `409` `ASSIGNMENT_NOT_SUBMITTED`, 응답에 채점 결과 필드 없음 |
| 4 | 첫 문제 답안 임시 저장 | `PUT /api/me/assignments/1/answers/1024` `{ "answer": "since" }` | `200`, `{ "questionId": 1024, "answer": "since", ... }`(정답 여부 없음), StudyRecord는 아직 생성되지 않음 |
| 5 | 저장 후 문제 목록 재조회 | 4번 이후 `GET /api/me/assignments/1/questions` | `200`, `questionId: 1024` 항목만 `myAnswer: "since"`로 변경, 목록의 `progress` 상승(정답 여부는 여전히 노출 안 됨) |
| 6 | 같은 문제 답안 덮어쓰기 | 4번 이후 다시 `PUT /api/me/assignments/1/answers/1024` `{ "answer": "for" }` | `200`, `myAnswer`가 `"for"`로 교체(새 기록이 쌓이지 않음, 이전 값 `"since"`는 남지 않음) |
| 7 | 과제에 없는 문제에 저장 시도 | `PUT /api/me/assignments/1/answers/999999` `{ "answer": "x" }` | `404` `QUESTION_NOT_IN_ASSIGNMENT` |
| 8 | 다른 학생의 과제 접근 | 본인이 대상이 아닌 `assignmentId`로 `GET /api/me/assignments/{id}/questions` | `404` `ASSIGNMENT_NOT_FOUND` |
| 9 | 예정 과제 접근 | `startDate`가 아직 지나지 않은 `assignmentId`로 `GET /api/me/assignments/{id}/questions` | `404` `ASSIGNMENT_NOT_FOUND`(목록에도 나타나지 않음) |
| 10 | 마감된 과제에 임시 저장/제출 시도 | `dueDate`가 지난 과제에 `PUT .../answers/{questionId}` 또는 `POST .../submit` | 둘 다 `409` `ASSIGNMENT_CLOSED` |
| 11 | 나머지 문제까지 저장 후 최종 제출 | 1023에 `"for"` 저장, 1021은 저장하지 않고 `POST /api/me/assignments/1/submit` | `200`, `submissionStatus: SUBMITTED`, `answeredQuestions: 2`, `correctCount: 1`(1023 오답, 1021 미응답), `results`에 1021도 `submittedAnswer: null`/`correct: false`로 포함, StudyRecord 3건 일괄 생성(`type: ASSIGNMENT`, 미응답 1021 포함) |
| 12 | 제출 후 임시 저장 시도 | 11번 이후 `PUT /api/me/assignments/1/answers/1024` `{ "answer": "for" }` | `409` `ASSIGNMENT_ALREADY_SUBMITTED` |
| 13 | 중복 최종 제출 | 11번 이후 다시 `POST /api/me/assignments/1/submit` | `409` `ASSIGNMENT_ALREADY_SUBMITTED`(재채점하지 않음, StudyRecord 추가 생성 없음, 기존 결과는 다음 시나리오처럼 `GET .../result`로 조회) |
| 14 | 제출 결과 조회(재조회) | 11번 이후 `GET /api/me/assignments/1/result` | `200`, 11번 제출 응답과 완전히 동일한 값(재채점 없음), 반복 호출해도 동일 |
| 15 | 제출 후 문제 목록 재조회 | 11번 이후 `GET /api/me/assignments/1/questions` | `200`, `submissionStatus: SUBMITTED`, 각 `myAnswer`는 제출 당시 값 유지, 정답/해설/정오 여부는 여전히 미포함 |
| 16 | 관리자 목록의 제출률 | 대상 학생 중 1명만 11번처럼 최종 제출 완료, 대상 학생 총 4명 | `GET /api/assignments`의 해당 항목 `progress: 25`(관리자 관점 — 최종 제출 완료 학생 수 ÷ 전체 대상 학생 수) |

---

### 자유 학습 (Practice, Phase 2 구현 범위)

이 절은 GitHub Issue #32(학생 객관식 자유 학습 + StudyRecord)의 계약이며, `/api/me/**`이므로 `ROLE_STUDENT`만 접근할 수 있습니다(`global/security/SecurityConfig.java`의 기존 경로 규칙을 그대로 따르며, 이 기능을 위한 보안 설정 변경은 없습니다). 학생의 식별은 항상 access token의 `memberId`(subject)로부터 얻으며, 요청 바디·경로·쿼리에 학생 ID를 받지 않습니다(다른 학생의 자원에 접근할 방법 자체가 없음).

**StudyRecord (자유 학습분)**

- 답안을 제출(`POST /api/me/practice/answers`)할 때마다 새 StudyRecord 1건이 생성됩니다. **불변**이며, 이를 수정·삭제하는 API는 없습니다.
- 같은 문제를 다시 제출해도(재응시) 기존 기록을 덮어쓰거나 병합하지 않고 항상 새 기록을 추가합니다. 멱등성이 없습니다 — 클라이언트가 실수로 같은 제출을 두 번 보내면 StudyRecord도 2건 생성됩니다(중복 방지용 idempotency key는 Phase 2 범위 밖).
- 생성 시점에 원본 `Question`의 `category`/`level`/`text`/`choices`/`answer`(정답)/`explanation`을 **스냅샷으로 함께 저장**합니다. 이후 관리자가 해당 문제를 수정(`PATCH /api/questions/{id}`)하거나 상태를 변경(`PATCH /api/questions/{id}/status`)해도 이미 생성된 StudyRecord의 스냅샷 값은 바뀌지 않습니다. `questionId`로 원본 문제를 참조하지만, 표시에는 항상 스냅샷을 사용합니다. Phase 2에는 문제 삭제 API가 없으므로(`PATCH`로 상태만 변경) `questionId`가 가리키는 원본이 사라지는 경우는 없지만, 상태가 `사용 중지`로 바뀐 뒤에도 스냅샷 조회에는 영향이 없습니다.
- `type`은 항상 `PRACTICE`입니다(Phase 2는 과제 기능이 없어 `ASSIGNMENT` 기록이 생성되지 않음).

---

#### GET `/api/me/practice/questions/next` — 자유 학습 문제 조회 (한 번에 하나)

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `category` | string | | 문법 항목 필터 (미지정 시 전체 문법 항목 대상) |
| `level` | string | | 난이도 필터 (`기초`/`보통`/`심화`, 미지정 시 전체 난이도 대상) |

문제 유형은 요청에서 지정할 수 없고 항상 객관식(`MULTIPLE_CHOICE`)으로 고정됩니다. 조회 대상은 `상태: 사용 중`인 객관식 문제로 한정합니다(`초안`/`사용 중지`는 노출되지 않습니다).

**선택 방식**: 조건(상태=`사용 중`, 유형=객관식, `category`/`level` 필터)에 맞는 문제 중 서버가 **매 요청마다 독립적으로 무작위로 하나**를 골라 반환합니다(균등 무작위, 복원 추출). 이전에 낸 문제나 학생의 풀이 이력을 고려하지 않으므로 같은 문제가 연속으로 나올 수 있습니다 — 재응시가 허용되는 정책과 일치하는 의도된 동작입니다.

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | 문제 ID |
| `category` | string | |
| `level` | string | `기초`/`보통`/`심화` |
| `type` | string | 항상 `"객관식"` |
| `text` | string | 문제 본문 |
| `choices` | string[] | 객관식 보기 |

```json
{
  "id": 1021,
  "category": "가정법",
  "level": "심화",
  "type": "객관식",
  "text": "If I _____ you, I would study harder.",
  "choices": ["am", "was", "were", "be"]
}
```

`answer`(정답)와 `explanation`(해설) 필드는 응답에 포함하지 않습니다(정답 유출 방지).

**Error**:
- `400 Bad Request` `{ "code": "INVALID_QUESTION", "message": "알 수 없는 난이도입니다: {level}" }` — `level`이 `기초`/`보통`/`심화` 중 하나가 아닌 경우(`GET /api/questions`의 `level` 필터와 동일하게 `QuestionLevel.fromLabel`을 재사용)
- `404 Not Found` `{ "code": "NO_QUESTION_AVAILABLE", "message": "조건에 맞는 문제가 없습니다." }` — 조건에 맞는 `사용 중` 객관식 문제가 하나도 없는 경우(전체 미존재 포함)

---

#### POST `/api/me/practice/answers` — 자유 학습 답안 제출

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `questionId` | long | ✓ | 대상 문제 ID (`GET /api/me/practice/questions/next`로 조회한 문제) |
| `answer` | string | ✓ | 제출한 답 |

```json
{ "questionId": 1021, "answer": "were" }
```

임시 저장 개념은 없습니다 — 제출은 항상 즉시 서버 채점으로 이어지고 StudyRecord 1건을 생성합니다.

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | 새로 생성된 StudyRecord ID |
| `questionId` | long | |
| `correct` | boolean | 제출한 `answer`가 정답과 일치하는지 여부 |
| `submittedAnswer` | string | 제출한 답 (요청의 `answer`와 동일) |
| `correctAnswer` | string | 문제의 정답(스냅샷) |
| `explanation` | string | 문제의 해설(스냅샷) |
| `submittedAt` | datetime | 제출 시각 |

```json
{
  "id": 501,
  "questionId": 1021,
  "correct": true,
  "submittedAnswer": "were",
  "correctAnswer": "were",
  "explanation": "가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다.",
  "submittedAt": "2026-08-13T10:15:00"
}
```

**Error**:
- `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }` — `questionId`/`answer` 누락 또는 형식 오류
- `404 Not Found` `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }` — `questionId`에 해당하는 문제가 없는 경우
- `409 Conflict` `{ "code": "QUESTION_NOT_IN_USE", "message": "사용 중인 문제만 풀 수 있습니다." }` — 대상 문제 상태가 `사용 중`이 아닌 경우(`초안`/`사용 중지`)
- `409 Conflict` `{ "code": "QUESTION_TYPE_NOT_SUPPORTED", "message": "객관식 문제만 풀 수 있습니다." }` — 대상 문제 유형이 객관식이 아닌 경우(Phase 2는 객관식만 지원; `questionId`를 직접 조작해 빈칸/오류 찾기 문제를 제출하려는 경우에 대한 방어)

---

#### GET `/api/me/practice/records` — 내 자유 학습 기록 목록

**Query Parameters**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `category` | string | | 스냅샷 문법 항목 필터 |
| `page` | int | | 기본값 0 |
| `size` | int | | 기본값 20 |

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | |
| `questionId` | long | 원본 문제 참조 |
| `type` | string | 항상 `"PRACTICE"` |
| `category` | string | |
| `level` | string | |
| `correct` | boolean | |
| `submittedAt` | datetime | |
| `text` | string | 제출 시점 문제 본문(스냅샷). 원본 `Question`이 이후 수정되어도 값이 바뀌지 않음 |

```json
{
  "content": [
    { "id": 501, "questionId": 1021, "type": "PRACTICE", "category": "가정법", "level": "심화", "correct": true, "submittedAt": "2026-08-13T10:15:00", "text": "If I _____ you, I would study harder." }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

목록 항목은 스냅샷 `text`를 포함하되 `choices`/정답/해설은 제외한 요약 필드로 구성됩니다. 항상 요청한 학생 본인의 기록만 반환합니다(다른 학생의 기록은 조회 결과에 나타나지 않음). 최신 제출이 먼저 오도록 `submittedAt` 내림차순으로 정렬합니다.

---

#### GET `/api/me/practice/records/{id}` — 내 자유 학습 기록 상세

**Path Parameters**: `id` (long, StudyRecord ID)

**Response** `200 OK`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | long | |
| `questionId` | long | 원본 문제 참조(표시는 항상 아래 `question` 스냅샷 사용) |
| `type` | string | 항상 `"PRACTICE"` |
| `question` | object | 제출 시점 문제 스냅샷 |
| `question.category` | string | |
| `question.level` | string | |
| `question.text` | string | |
| `question.choices` | string[] | |
| `question.correctAnswer` | string | |
| `question.explanation` | string | |
| `submittedAnswer` | string | 제출한 답 |
| `correct` | boolean | |
| `submittedAt` | datetime | |

```json
{
  "id": 501,
  "questionId": 1021,
  "type": "PRACTICE",
  "question": {
    "category": "가정법",
    "level": "심화",
    "text": "If I _____ you, I would study harder.",
    "choices": ["am", "was", "were", "be"],
    "correctAnswer": "were",
    "explanation": "가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다."
  },
  "submittedAnswer": "were",
  "correct": true,
  "submittedAt": "2026-08-13T10:15:00"
}
```

**Error**: `404 Not Found` `{ "code": "STUDY_RECORD_NOT_FOUND", "message": "학습 기록을 찾을 수 없습니다." }` — `id`가 존재하지 않거나 **다른 학생 소유인 경우에도 동일하게 404**를 반환합니다(다른 학생의 기록 존재 여부를 `403`으로 노출하지 않기 위함 — 소유권 검사는 조회 쿼리 자체를 "본인 소유 AND id 일치"로 제한해 구현하고, 소유자가 다르면 애초에 조회되지 않도록 합니다).

---

#### 인수 테스트 시나리오 (Acceptance Examples)

아래 시나리오는 백엔드 통합 테스트와 프론트엔드 계약 테스트가 그대로 가져다 쓸 수 있는 구체적인 예시입니다. 문제 데이터는 `GET /api/questions` 예시(`id: 1024`, 정답 `since`)와 위 가정법 문제(`id: 1021`, 정답 `were`, 상태 `사용 중`)를 사용합니다.

| # | 시나리오 | 요청 | 기대 결과 |
| --- | --- | --- | --- |
| 1 | 필터 없이 다음 문제 조회 | `GET /api/me/practice/questions/next` | `200`, `사용 중` 객관식 문제 중 하나(정답/해설 없음) |
| 2 | `category`+`level` 필터로 조회 | `GET /api/me/practice/questions/next?category=가정법&level=심화` | `200`, `id: 1021` 문제 반환 |
| 3 | 조건에 맞는 문제 없음 | `GET /api/me/practice/questions/next?category=존재하지않는항목` | `404` `NO_QUESTION_AVAILABLE` |
| 4 | 잘못된 `level` 값 | `GET /api/me/practice/questions/next?level=매우쉬움` | `400` `INVALID_QUESTION` |
| 5 | 정답 제출 | `POST /api/me/practice/answers` `{ "questionId": 1021, "answer": "were" }` | `200`, `correct: true`, `correctAnswer: "were"`, StudyRecord 1건 생성 |
| 6 | 오답 제출 | `POST /api/me/practice/answers` `{ "questionId": 1021, "answer": "am" }` | `200`, `correct: false`, `submittedAnswer: "am"`, `correctAnswer: "were"`(정답 그대로 공개) |
| 7 | 같은 문제 재응시 | 5번 이후 다시 `POST /api/me/practice/answers` `{ "questionId": 1021, "answer": "am" }` | `200`, 새 `id`(5번과 다른 StudyRecord ID)로 별도 기록 생성. 5번 기록은 그대로 유지됨 |
| 8 | 존재하지 않는 문제 제출 | `POST /api/me/practice/answers` `{ "questionId": 999999, "answer": "were" }` | `404` `QUESTION_NOT_FOUND` |
| 9 | `초안`/`사용 중지` 문제 제출 | 상태가 `사용 중`이 아닌 `questionId`로 제출 | `409` `QUESTION_NOT_IN_USE` |
| 10 | 문제 수정 후 기존 기록 스냅샷 불변 확인 | 5번 제출 후 관리자가 `PATCH /api/questions/1021`로 `text`/`explanation` 변경 → `GET /api/me/practice/records/{5번 id}`, `GET /api/me/practice/records` | `200`, `question.explanation`과 `question.text`(상세), `content[].text`(목록) 모두 제출 당시 값 그대로(수정된 값 아님) |
| 11 | 본인 기록 목록 | `GET /api/me/practice/records` | `200`, `content`에 5·6·7번에서 생성된 기록만 포함(다른 학생 기록 없음), 각 항목에 제출 당시 문제 본문(`text`) 포함 |
| 12 | 본인 기록 상세 | `GET /api/me/practice/records/{5번 id}` | `200`, 전체 스냅샷 반환 |
| 13 | 다른 학생 기록 상세 접근 | 학생 B의 토큰으로 `GET /api/me/practice/records/{5번 id}`(학생 A 소유) | `404` `STUDY_RECORD_NOT_FOUND` (`403` 아님) |
| 14 | 필수 필드 누락 제출 | `POST /api/me/practice/answers` `{ "questionId": 1021 }` | `400` `INVALID_REQUEST` |

---

## 오답노트 (WrongAnswer)

**Phase 5 범위(미구현)**: 이 절 전체와 `POST /api/me/wrong-answers/{id}/retry`, 그리고 향후 취약 문법 기반 문제 자동 추천 로직은 모두 Phase 5 이후 범위이며 Phase 4에서 구현하지 않습니다. `WrongAnswer` 도메인 모델 자체가 아직 존재하지 않습니다 — 현재 코드베이스에는 오답 여부(`StudyRecord.correct = false`)만 있을 뿐, "복습 상태"(미복습/복습 중/해결)나 오답 횟수를 별도로 추적하는 테이블이 없습니다. 이 절의 요청/응답 형태는 향후 설계를 위한 초안이며, 실제 구현 시 이 문서를 갱신해야 합니다. 학생 대시보드의 `weakCategories`는 이 절과 무관한 별도의 읽기 전용 집계이며([정의](#weakcategories-최소-표본-규칙) 참고), 오답노트/재응시 기능이 없어도 동작합니다.

### GET `/api/me/wrong-answers` — 오답노트 조회

**Query Parameters**: `category`, `status`(`미복습`/`복습 중`/`해결`)

**Response** `200 OK`
```json
{
  "content": [
    {
      "id": 88,
      "questionId": 1021,
      "questionText": "If I _____ you, I would study harder.",
      "category": "가정법",
      "wrongCount": 3,
      "lastWrongAt": "2026-07-30",
      "status": "미복습"
    }
  ]
}
```

### POST `/api/me/wrong-answers/{id}/retry` — 오답 문제 다시 풀기

**Response** `200 OK` — 문제 풀이 화면 진입용 데이터 (정답/해설 제외)
```json
{
  "questionId": 1021,
  "category": "가정법",
  "text": "If I _____ you, I would study harder.",
  "choices": ["am", "was", "were", "be"]
}
```

**Error**: `404 Not Found` `{ "code": "WRONG_ANSWER_NOT_FOUND", "message": "오답노트 항목을 찾을 수 없습니다." }`
