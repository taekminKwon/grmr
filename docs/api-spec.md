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

refresh token은 회원 계정(`memberId`)을 키로 Redis에 저장되며, 로그인/재발급 시 갱신되고 로그아웃 시 삭제됩니다. 상세는 [docs/api-spec-detail.md](api-spec-detail.md#인증-auth) 참고.

## 문제 (Question)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/questions` | 문제 목록 조회. 쿼리: `category`, `type`, `level`, `status`, `keyword`, `page`, `size` |
| GET | `/api/questions/{id}` | 문제 상세 조회 |
| POST | `/api/questions` | 문제 직접 등록 (초안으로 생성) |
| PATCH | `/api/questions/{id}` | 문제 내용 수정 |
| PATCH | `/api/questions/{id}/status` | 문제 상태 변경 (`사용 중` ↔ `사용 중지`) |

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
| GET | `/api/me/history` | 내 학습 이력 조회 (학생 본인). 쿼리: `period`, `type` |

**응답 필드**: `studentId`, `studentName`, `date`, `type`, `questionCount`, `accuracy`, `durationMinutes`

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

## 오답노트 (WrongAnswer)

| Method | Path | 설명 |
| --- | --- | --- |
| GET | `/api/me/wrong-answers` | 오답노트 조회. 쿼리: `category`, `status`(`미복습`/`복습 중`/`해결`) |
| POST | `/api/me/wrong-answers/{id}/retry` | 오답 문제 다시 풀기 시작 (문제 풀이 화면 진입용 데이터 반환) |

**응답 필드**: `id`, `questionId`, `questionText`, `category`, `wrongCount`, `lastWrongAt`, `status`
