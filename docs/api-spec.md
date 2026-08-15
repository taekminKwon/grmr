# API 명세

`docs/feature-spec.md`의 기능을 기준으로 설계한 REST API 초안입니다. 아직 컨트롤러 구현은 없으며, 이 문서는 `backend/` 구현의 기준이 됩니다. 실제 구현 중 필요에 따라 갱신하세요.

엔드포인트별 요청/응답 필드를 상세히 정리한 문서는 [docs/api-spec-detail.md](api-spec-detail.md)를 참고하세요.

## 공통 규칙

- Base path: `/api`
- 요청/응답 포맷: JSON (`application/json`)
- 인증: JWT 기반. `/api/auth/**`를 제외한 모든 엔드포인트는 `Authorization: Bearer {accessToken}` 헤더가 필요합니다. 관리자 전용 엔드포인트(`/api/questions/**`, `/api/assignments/**`, `/api/students/**`, `/api/study-records`, `/api/dashboard/admin`)는 `ROLE_ADMIN`, 학생 전용(`/api/me/**`)은 `ROLE_STUDENT` 권한이 필요합니다. 상세는 아래 [인증 (Auth)](#인증-auth) 참고.
- `/api/me/**` 엔드포인트는 항상 access token의 `memberId`(subject)로 식별한 학생 본인의 자원만 다룹니다. 요청 바디·경로·쿼리로 학생 ID를 받지 않으며, 다른 학생의 자원에 접근할 방법 자체가 없습니다.
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

**Phase 3(MVP) 구현 범위**입니다. `/api/assignments/**` 전체가 `ROLE_ADMIN` 전용입니다.

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/assignments` | 과제 목록 조회. 쿼리: `status`, `keyword`, `page`, `size` |
| GET | `/api/assignments/{id}` | 과제 상세 조회 (포함된 문제 목록·순서 포함) |
| POST | `/api/assignments` | 과제 생성 |
| PATCH | `/api/assignments/{id}` | 과제 수정 (대상, 시작일, 마감일, 문제 구성) |
| DELETE | `/api/assignments/{id}` | 과제 삭제 |

**상태(`status`)**: `예정`/`진행 중`/`마감` 세 값을 서버가 `startDate`/`dueDate` 기준으로 자동 계산합니다 — 오늘이 `startDate` 이전이면 `예정`, `startDate` 이상 `dueDate` 이하이면 `진행 중`, `dueDate`를 지나면 `마감`입니다(경계값은 양쪽 다 포함). 별도의 상태 변경 API는 없습니다. `startDate ≤ dueDate`는 생성·수정 시 서버가 검증하는 불변 조건입니다(위반 시 `400 Bad Request`). 근거는 [feature-spec.md의 과제 상태 도메인 용어](feature-spec.md#도메인-용어) 참고.

**대상(target) 지정**: 새로운 반/그룹 데이터 모델을 만들지 않고 기존 [학생(Student)](#학생-student-관리자-관점)의 필드를 재사용합니다. `targetType: "CLASS"`면 학생의 `group`과 동일한 문자열을 `targetGroup`으로, `targetType: "STUDENT"`면 학생의 `id`(long)를 `targetStudentId`로 지정합니다(둘 중 `targetType`에 해당하는 필드만 필수).

**POST `/api/assignments` 요청 예시 (반 대상)**
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
개별 학생 대상 예시: `{ "targetType": "STUDENT", "targetStudentId": 501, "title": "...", "startDate": "...", "dueDate": "...", "questionIds": [...] }`

`questionIds` 배열의 순서가 곧 학생에게 노출되는 문제 풀이 순서입니다(1번째 원소가 1번 문항). 최소 1개 이상이어야 합니다.

**응답 필드**: `id`, `title`, `targetType`, `targetGroup`(또는 `targetStudentId`), `target`(표시용 문자열, 예: `"중1 A반"`), `startDate`, `dueDate`, `status`, `progress`(제출률 %, 관리자 관점 — 최종 제출을 완료한 학생 비율, 정의는 [feature-spec.md](feature-spec.md#도메인-용어) 참고)

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

**Phase 2/3 범위**: Phase 2에서는 `type: "PRACTICE"` 기록만 생성되었고, **Phase 3(MVP)부터 과제 최종 제출 시 과제에 포함된 문제마다(미응답 문제 포함) `type: "ASSIGNMENT"` 기록이 일괄 생성**됩니다(문제를 임시 저장할 때가 아니라 최종 제출할 때 한 번에 생성됨). 이 두 엔드포인트는 여러 학생/기간에 걸친 일자별 집계(rollup) 조회용입니다. 자유 학습의 제출 건별 상세(스냅샷)는 [자유 학습(Practice)](#자유-학습-practice-phase-2-구현-범위)의 `GET /api/me/practice/records`/`GET /api/me/practice/records/{id}`를 사용하고, 과제의 제출 건별 상세(문제별 정답·해설·정오 여부)는 제출 후 [내 과제](#내-과제-phase-3-mvp-구현-범위)의 `GET /api/me/assignments/{assignmentId}/result`를 사용합니다.

## 대시보드

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/dashboard/admin` | 관리자 대시보드 지표(학생 수, 오늘 학습 학생, 과제 현황, 문법별 정답률, 미제출 알림) |
| GET | `/api/me/dashboard` | 학생 대시보드 지표(오늘 푼 문제, 오늘 정답률, 오늘 학습 시간, 취약 문법 TOP3) |

## 내 과제 / 문제 풀이 (학생)

**Phase 2/3 구현 범위**: 이 섹션 중 **자유 학습(Practice)**은 Phase 2에서, **내 과제(Assignment)**는 Phase 3(MVP)에서 구현합니다. `/api/me/**`이므로 `ROLE_STUDENT`만 접근할 수 있고, 학생 식별은 항상 access token의 `memberId`(subject)로부터 얻습니다([공통 규칙](#공통-규칙) 참고).

### 내 과제 (Phase 3 MVP 구현 범위)

과제 수행은 CBT 방식입니다 — 문제별 답안은 **임시 저장**만 되고 채점되지 않으며, 학생이 **최종 제출**을 호출한 시점에만 한 번에 채점됩니다(정답/해설/점수는 그 전까지 어떤 응답에도 노출되지 않습니다). 임시 저장 데이터는 PostgreSQL에 영속 저장되는 정식 데이터이며 캐시가 아닙니다.

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/assignments` | 내 과제 목록 (진행률, 제출 상태, 마감일 포함). 쿼리: `page`, `size` |
| GET | `/api/me/assignments/{assignmentId}/questions` | 과제 문제 목록 조회(풀이 화면 진입 — 정답/해설 제외). 최초 호출 시 제출 상태를 `IN_PROGRESS`로 시작하며, 이후 호출은 저장된 임시 답안과 함께 이어서 조회(재개)됩니다 |
| PUT | `/api/me/assignments/{assignmentId}/answers/{questionId}` | 문제 1개에 대한 답안 임시 저장(덮어쓰기, 채점 없음) |
| POST | `/api/me/assignments/{assignmentId}/submit` | 최종 제출 — 그때까지 임시 저장된 답안을 일괄 채점하고 제출을 잠금 |
| GET | `/api/me/assignments/{assignmentId}/result` | 최종 제출 결과 조회 — `SUBMITTED` 이후에만 허용, 제출 후 몇 번이든 재조회 가능 |

**접근 규칙**: 상태가 `예정`인 과제(오늘이 `startDate` 이전)는 학생에게 완전히 숨겨집니다 — `GET /api/me/assignments` 목록에 나타나지 않고, 위 나머지 네 엔드포인트를 직접 호출해도 `404 Not Found`(`ASSIGNMENT_NOT_FOUND`, 대상이 아닌 과제와 동일하게 처리)를 반환합니다. `GET .../result`는 대상 판정을 통과하더라도 아직 제출하지 않은 과제(`submissionStatus`가 `NOT_STARTED`/`IN_PROGRESS`)면 `409 Conflict`(`ASSIGNMENT_NOT_SUBMITTED`)를 반환하며 채점 결과를 노출하지 않습니다.

**GET `/api/me/assignments` 응답 필드**: `id`, `title`, `startDate`, `dueDate`, `status`(`진행 중`/`마감`, `예정`은 숨겨지므로 나타나지 않음), `submissionStatus`(`NOT_STARTED`/`IN_PROGRESS`/`SUBMITTED`), `progress`(내 진행률 %, "임시 저장한 답안이 있는 문제 수 ÷ 전체 문제 수" — 채점 결과와 무관, 정의는 [feature-spec.md](feature-spec.md#도메인-용어) 참고)

**GET `/api/me/assignments/{assignmentId}/questions` 응답 예시**
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
`order`는 과제 생성/수정 시 지정한 `questionIds` 순서입니다. `myAnswer`는 이 학생이 임시 저장한 답(없으면 `null`)이며, 정답 여부는 절대 포함하지 않습니다. "이어서 풀기"는 `myAnswer: null`인 첫 문제로 이동하는 방식으로 클라이언트가 구현합니다. 정답(`answer`)과 해설(`explanation`)도 포함하지 않습니다. `submissionStatus`가 `SUBMITTED`이면 이미 잠긴 과제이며, 이 경우에도 `myAnswer`는 제출 당시 값을 그대로 보여주되 정답/해설/정오 여부는 여전히 포함하지 않습니다(채점 결과는 `GET /api/me/assignments/{assignmentId}/result`로 확인합니다).

**PUT `/api/me/assignments/{assignmentId}/answers/{questionId}` 요청**
```json
{ "answer": "since" }
```
채점하지 않고 저장만 합니다(`saved: true`만 응답). 같은 문제에 다시 호출하면 이전 임시 저장 값을 덮어씁니다. `submissionStatus`가 `SUBMITTED`이거나 과제 상태가 `마감`이면 저장할 수 없습니다(`409 Conflict`).

**POST `/api/me/assignments/{assignmentId}/submit` 요청**: 바디 없음. 그 시점까지 임시 저장된 모든 답안을 한 번에 채점하고, 문제별 `ASSIGNMENT` 학습 기록(StudyRecord)을 일괄 생성하며 `submissionStatus`를 `SUBMITTED`로 잠급니다(원자적 처리 — 상세는 [docs/api-spec-detail.md](api-spec-detail.md#post-apimeassignmentsassignmentidsubmit--최종-제출) 참고).

**응답 (채점 결과)**
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
    { "questionId": 1021, "submittedAnswer": null, "correct": false, "correctAnswer": "were", "explanation": "..." }
  ]
}
```
임시 저장이 없던 문제는 `submittedAnswer: null`, `correct: false`로 채점되며, 미응답 문제를 포함해 과제의 모든 문제마다 학습 기록(StudyRecord)이 하나씩 생성됩니다(제출 시점의 결과를 원본 문제 변경과 무관하게 그대로 재구성할 수 있도록). 이미 `SUBMITTED`인 과제에 다시 제출을 호출하면 재채점하지 않고 `409 Conflict`(`ASSIGNMENT_ALREADY_SUBMITTED`)를 반환합니다 — 이 경우 클라이언트는 이 응답과 동일한 구조를 반환하는 `GET /api/me/assignments/{assignmentId}/result`로 기존 결과를 조회합니다. 마감된 과제(`status: 마감`)에는 제출할 수 없습니다(`409 Conflict`, `ASSIGNMENT_CLOSED`).

**GET `/api/me/assignments/{assignmentId}/result` 응답**: 위 최종 제출 응답과 완전히 동일한 구조를 반환합니다(재채점 없이 저장된 결과를 그대로 재구성). 제출 상태가 `SUBMITTED`가 아닌 과제(`NOT_STARTED`/`IN_PROGRESS`)에 호출하면 채점 결과를 전혀 노출하지 않고 `409 Conflict`(`ASSIGNMENT_NOT_SUBMITTED`)를 반환합니다. 상세는 [docs/api-spec-detail.md](api-spec-detail.md#내-과제-phase-3-mvp-구현-범위) 참고.

### 자유 학습 (Practice, Phase 2 구현 범위)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/practice/questions/next` | 자유 학습 문제 조회 — 조건에 맞는 `사용 중` 객관식 문제 중 하나를 반환(정답/해설 제외). 쿼리: `category`, `level` (둘 다 선택) |
| POST | `/api/me/practice/answers` | 자유 학습 답안 제출 — 서버가 즉시 채점하고 학습 기록(StudyRecord)을 생성 |
| GET | `/api/me/practice/records` | 내 자유 학습 기록 목록(제출 이력, 페이지네이션). 쿼리: `category`, `page`, `size` |
| GET | `/api/me/practice/records/{id}` | 내 자유 학습 기록 상세(제출 시점 문제 스냅샷 포함) |

자유 학습에는 임시 저장 개념이 없습니다(제출은 항상 즉시 채점). 같은 문제를 여러 번 제출해도(재응시) 매번 새 학습 기록이 생성되며 이전 기록을 덮어쓰지 않습니다. 상세는 [docs/api-spec-detail.md](api-spec-detail.md#자유-학습-practice-phase-2-구현-범위) 참고.

**GET `/api/me/practice/questions/next` 응답 예시**
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
정답(`answer`)과 해설(`explanation`)은 포함하지 않습니다. 조건에 맞는 문제가 없으면 `404 Not Found`(`NO_QUESTION_AVAILABLE`)를 반환합니다.

**POST `/api/me/practice/answers` 요청**
```json
{ "questionId": 1021, "answer": "were" }
```

**응답**
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
`id`는 새로 생성된 학습 기록(StudyRecord)의 ID입니다. 대상 문제가 `사용 중` 상태가 아니거나 객관식이 아니면 제출할 수 없습니다(`409 Conflict`).

**GET `/api/me/practice/records` 응답 예시**
```json
{
  "content": [
    { "id": 501, "questionId": 1021, "type": "PRACTICE", "category": "가정법", "level": "심화", "correct": true, "submittedAt": "2026-08-13T10:15:00", "text": "If I _____ you, I would study harder." }
  ],
  "page": 0, "size": 20, "totalElements": 1, "totalPages": 1
}
```

**GET `/api/me/practice/records/{id}` 응답 예시**
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
`question`은 제출 시점 스냅샷입니다. 이후 원본 문제(`questionId`)가 수정되거나 상태가 바뀌어도 이 값은 변하지 않습니다. 다른 학생의 기록이거나 존재하지 않는 `id`는 `404 Not Found`(`STUDY_RECORD_NOT_FOUND`)를 반환합니다(자신의 기록 존재 여부를 그 외에는 노출하지 않기 위해 `403` 대신 `404`를 사용).

## 오답노트 (WrongAnswer)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/wrong-answers` | 오답노트 조회. 쿼리: `category`, `status`(`미복습`/`복습 중`/`해결`) |
| POST | `/api/me/wrong-answers/{id}/retry` | 오답 문제 다시 풀기 시작 (문제 풀이 화면 진입용 데이터 반환) |

**응답 필드**: `id`, `questionId`, `questionText`, `category`, `wrongCount`, `lastWrongAt`, `status`
