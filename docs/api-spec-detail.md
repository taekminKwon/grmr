# API 상세 명세

[docs/api-spec.md](api-spec.md)의 엔드포인트 목록을 기준으로, 엔드포인트별 요청/응답을 필드 단위로 정리한 상세 명세입니다. 값 표기(예: `category: "현재완료"`, `status: "사용 중"`)는 `api-spec.md`와 동일하게 와이어프레임의 한글 값을 그대로 사용합니다. 실제 구현 시 필요하면 이 문서를 갱신하세요.

## 공통 규칙

- Base path: `/api`, 포맷: `application/json`
- 목록 조회는 페이지네이션 응답을 사용합니다.
  ```json
  { "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }
  ```
- 공통 에러 응답: `{ "code": "...", "message": "..." }`
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

### GET `/api/me/assignments` — 내 과제 목록

**Response** `200 OK`
```json
{
  "content": [
    { "id": 1, "title": "현재완료 시제 연습", "dueDate": "2026-08-05", "progress": 40, "status": "진행 중" }
  ]
}
```

### GET `/api/me/assignments/{assignmentId}/questions` — 과제 문제 목록 (풀이용)

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

### POST `/api/me/assignments/{assignmentId}/answers` — 답안 제출/임시 저장

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

### GET `/api/me/practice/questions` — 자유 학습 문제 조회

**Query Parameters**: `category` (미지정 시 취약 문법 우선 출제)

**Response** `200 OK`: `GET /api/me/assignments/{assignmentId}/questions`와 동일한 문제 구조를 `assignmentId` 없이 반환
```json
{
  "questions": [
    { "id": 1021, "category": "가정법", "text": "If I _____ you, I would study harder.", "choices": ["am", "was", "were", "be"] }
  ]
}
```

자유 학습 문제 조회 대상은 `상태: 사용 중`인 문제로 한정합니다(`초안`/`사용 중지`는 학생에게 노출되지 않습니다).

### POST `/api/me/practice/answers` — 자유 학습 답안 제출/임시 저장

`POST /api/me/assignments/{assignmentId}/answers`와 동일한 요청/응답 형식을 사용하되, 과제에 속하지 않는 자유 학습 문제(`GET /api/me/practice/questions`로 조회한 문제)를 대상으로 합니다. `assignmentId`는 없습니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `questionId` | long | ✓ | 대상 문제 ID |
| `answer` | string | ✓ | 제출한 답 |
| `final` | boolean | ✓ | `false`: 임시 저장, `true`: 채점 |

```json
{ "questionId": 1021, "answer": "were", "final": true }
```

**Response** `200 OK`

`final: false`
```json
{ "saved": true }
```

`final: true`
```json
{
  "questionId": 1021,
  "correct": true,
  "answer": "were",
  "explanation": "가정법 과거에서는 주어의 인칭에 관계없이 be동사로 were를 씁니다."
}
```

`correct`는 제출한 `answer`가 문제의 정답과 일치하는지 여부이며, `answer`/`explanation`은 (제출 값이 아닌) 문제의 정답/해설입니다. 이 필드 의미는 과제 답안 제출 응답과 동일합니다.

**Error**:
- `400 Bad Request` `{ "code": "INVALID_REQUEST", "message": "..." }` — `questionId`/`answer`/`final` 누락 또는 형식 오류
- `404 Not Found` `{ "code": "QUESTION_NOT_FOUND", "message": "문제를 찾을 수 없습니다." }`
- `409 Conflict` `{ "code": "QUESTION_NOT_IN_USE", "message": "사용 중인 문제만 풀 수 있습니다." }` — 대상 문제 상태가 `사용 중`이 아닌 경우(`초안`/`사용 중지`)

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
