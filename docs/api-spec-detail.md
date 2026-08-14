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

### GET `/api/assignments` — 과제 목록 조회

**Query Parameters**: `status`(`예정`/`진행 중`/`마감`), `keyword`, `page`, `size`

**Response** `200 OK`
```json
{
  "content": [
    { "id": 1, "title": "현재완료 시제 연습", "target": "중1 A반", "dueDate": "2026-08-05", "progress": 84, "status": "진행 중" }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

---

### GET `/api/assignments/{id}` — 과제 상세 조회

**Response** `200 OK`
```json
{
  "id": 1,
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "target": "중1 A반",
  "dueDate": "2026-08-05",
  "status": "진행 중",
  "progress": 84,
  "questions": [
    { "id": 1024, "text": "He has lived here _____ 2010.", "category": "현재완료" }
  ]
}
```

**Error**: `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }`

---

### POST `/api/assignments` — 과제 생성

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `title` | string | ✓ | 과제명 |
| `targetType` | string | ✓ | `CLASS` 또는 `STUDENT` |
| `targetId` | string | ✓ | 반 이름 또는 학생 ID |
| `dueDate` | date | ✓ | 마감일 (`YYYY-MM-DD`) |
| `questionIds` | long[] | ✓ | 포함할 문제 ID 목록 (최소 1개) |

```json
{
  "title": "현재완료 시제 연습",
  "targetType": "CLASS",
  "targetId": "중1 A반",
  "dueDate": "2026-08-10",
  "questionIds": [1024, 1023, 1021]
}
```

**Response** `201 Created`, `Location: /api/assignments/{id}`
```json
{
  "id": 4,
  "title": "현재완료 시제 연습",
  "target": "중1 A반",
  "dueDate": "2026-08-10",
  "status": "예정",
  "progress": 0
}
```

**Error**: `400 Bad Request` `{ "code": "INVALID_ASSIGNMENT", "message": "문제를 1개 이상 선택해야 합니다." }`

---

### PATCH `/api/assignments/{id}` — 과제 수정

**Request Body**: `targetType`, `targetId`, `dueDate`, `questionIds` 중 변경할 항목만 포함

```json
{ "dueDate": "2026-08-12" }
```

**Response** `200 OK`: 수정된 과제 상세 (GET 상세 조회와 동일 구조)

**Error**: `404 Not Found`(`ASSIGNMENT_NOT_FOUND`), `409 Conflict` `{ "code": "ASSIGNMENT_ALREADY_CLOSED", "message": "마감된 과제는 수정할 수 없습니다." }`

---

### DELETE `/api/assignments/{id}` — 과제 삭제

**Response** `204 No Content`

**Error**: `404 Not Found`(`ASSIGNMENT_NOT_FOUND`)

---

## 학생 (Student, 관리자 관점)

### GET `/api/students` — 학생 목록 조회

**Query Parameters**: `group`, `keyword`, `page`, `size`

**Response** `200 OK`
```json
{
  "content": [
    { "id": 501, "name": "김민수", "group": "중1 A반", "lastStudiedAt": "2026-08-01", "cumulativeAccuracy": 74, "missingCount": 1 }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

### GET `/api/students/{id}` — 학생 상세 조회

**Response** `200 OK`
```json
{
  "id": 501,
  "name": "김민수",
  "group": "중1 A반",
  "lastStudiedAt": "2026-08-01",
  "cumulativeAccuracy": 74,
  "missingCount": 1
}
```

**Error**: `404 Not Found` `{ "code": "STUDENT_NOT_FOUND", "message": "학생을 찾을 수 없습니다." }`

---

## 학습 이력 (StudyRecord)

`type`의 API 쿼리 값과 응답 값은 항상 `ASSIGNMENT`(과제) 또는 `PRACTICE`(자유 학습)입니다. "과제"/"자유 학습"은 화면에 표시하는 한글 라벨일 뿐, API 쿼리·응답 값으로는 사용하지 않습니다.

**Phase 2 범위**: 과제(Assignment) 기능이 아직 없으므로 Phase 2에서는 `type: "PRACTICE"` 기록만 생성됩니다. 아래 두 엔드포인트는 여러 학생/기간에 걸친 일자별 집계(rollup) 조회용이며, 제출 건별 상세(스냅샷 포함)는 이 문서의 [자유 학습(Practice)](#자유-학습-practice-phase-2-구현-범위) 절의 `GET /api/me/practice/records`/`GET /api/me/practice/records/{id}`를 사용합니다. `StudyRecord` 자체(스냅샷 필드, 불변성, 재응시 처리)에 대한 정의도 그 절에서 함께 다룹니다.

### GET `/api/study-records` — 학습 이력 조회 (관리자용)

**Query Parameters**: `studentId`, `period`(`7d`/`30d`), `type`(`ASSIGNMENT`/`PRACTICE`), `page`, `size`

**Response** `200 OK`
```json
{
  "content": [
    { "studentId": 501, "studentName": "김민수", "date": "2026-08-01", "type": "ASSIGNMENT", "questionCount": 20, "accuracy": 80, "durationMinutes": 32 }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

### GET `/api/me/history` — 내 학습 이력 조회 (학생 본인)

**Query Parameters**: `period`(`7d`/`30d`), `type`(`ASSIGNMENT`/`PRACTICE`)

**Response** `200 OK`
```json
{
  "summary": {
    "totalSolved": 342,
    "cumulativeAccuracy": 74,
    "totalStudyMinutes": 660,
    "resolvedWrongAnswers": 58
  },
  "byCategory": [
    { "category": "현재완료", "accuracy": 82 },
    { "category": "수동태", "accuracy": 65 }
  ],
  "records": [
    { "date": "2026-08-01", "type": "ASSIGNMENT", "questionCount": 20, "accuracy": 80 }
  ]
}
```

---

## 대시보드

### GET `/api/dashboard/admin` — 관리자 대시보드

**Response** `200 OK`
```json
{
  "totalStudents": 128,
  "todayActiveStudents": 45,
  "inProgressAssignments": 8,
  "unsubmittedAssignments": 23,
  "weeklyStudyVolume": [
    { "day": "월", "value": 46 },
    { "day": "화", "value": 61 }
  ],
  "accuracyByCategory": [
    { "category": "시제", "accuracy": 82 },
    { "category": "가정법", "accuracy": 45 }
  ],
  "unsubmittedAlerts": [
    { "studentName": "김민수", "assignmentTitle": "현재완료 시제 연습", "note": "마감 D-4" }
  ]
}
```

### GET `/api/me/dashboard` — 학생 대시보드

**Response** `200 OK`
```json
{
  "todaySolvedCount": 12,
  "todayAccuracy": 75,
  "todayStudyMinutes": 30,
  "incompleteAssignmentCount": 2,
  "weakCategories": [
    { "category": "가정법", "accuracy": 45 },
    { "category": "관계대명사", "accuracy": 58 }
  ]
}
```

---

## 내 과제 / 문제 풀이 (학생)

**Phase 2 구현 범위**: 이 문서 중 [자유 학습(Practice)](#자유-학습-practice-phase-2-구현-범위) 절만 Phase 2에서 구현합니다. 아래 "내 과제" 절(과제 목록/과제 문제/과제 답안 제출)은 과제(Assignment) 기능 자체가 아직 없어 계약만 정의된 향후 범위이며 변경하지 않았습니다.

### 내 과제 (향후 범위 — Phase 2 제외)

#### GET `/api/me/assignments` — 내 과제 목록

**Response** `200 OK`
```json
{
  "content": [
    { "id": 1, "title": "현재완료 시제 연습", "dueDate": "2026-08-05", "progress": 40, "status": "진행 중" }
  ]
}
```

#### GET `/api/me/assignments/{assignmentId}/questions` — 과제 문제 목록 (풀이용)

정답·해설은 제출 전까지 노출하지 않습니다.

**Response** `200 OK`
```json
{
  "assignmentId": 1,
  "questions": [
    { "id": 1024, "order": 1, "category": "현재완료", "text": "He has lived here _____ 2010.", "choices": ["for", "since", "during", "from"] }
  ]
}
```

**Error**: `404 Not Found` `{ "code": "ASSIGNMENT_NOT_FOUND", "message": "과제를 찾을 수 없습니다." }`

#### POST `/api/me/assignments/{assignmentId}/answers` — 답안 제출/임시 저장

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `questionId` | long | ✓ | |
| `answer` | string | ✓ | 선택한 답 |
| `final` | boolean | ✓ | `false`: 임시 저장, `true`: 채점 |

```json
{ "questionId": 1024, "answer": "since", "final": true }
```

**Response** `200 OK`

`final: false`
```json
{ "saved": true }
```

`final: true`
```json
{
  "questionId": 1024,
  "correct": true,
  "answer": "since",
  "explanation": "특정 시작 시점과 현재완료가 함께 쓰일 때 since를 사용합니다."
}
```

**Error**: `404 Not Found`(`QUESTION_NOT_FOUND`), `409 Conflict` `{ "code": "ASSIGNMENT_CLOSED", "message": "마감된 과제에는 답안을 제출할 수 없습니다." }`

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
