# 코드 컨벤션 (backend)

아직 실제 도메인 코드가 거의 없는 초기 단계라(`GrmrApplication`, `GrmrApplicationTests`만 존재) 히스토리에서 끌어올 만한 확립된 패턴이 없습니다. 이 문서는 `backend/build.gradle`에 명시된 스택을 기준으로 한 시작점이며, 코드가 쌓이면 실제 코드에 맞춰 갱신해야 합니다.

## 아키텍처: 도메인 우선 분리 + 계층형 아키텍처 + 도메인 모델 패턴

**패키지는 도메인(기능)으로 먼저 나누고, 그 안에서 계층(역할)으로 다시 나눕니다.** 최상위 패키지가 `member`, `auth`, `question`, `assignment`, `student`, `studyrecord`, `wronganswer` 같은 도메인 단위이고, 각 도메인 패키지 안에 `domain` / `application` / `presentation` / `infrastructure`를 둡니다. 여러 도메인을 가로지르는 전역 설정(Spring Security 필터 체인, Batch 공통 설정 등)은 어느 도메인에도 속하지 않으므로 별도 `global` 패키지에 둡니다.

```
com.ewha_eng.grmr
├── global                          # 특정 도메인에 속하지 않는 전역 설정
│   ├── security
│   │   ├── SecurityConfig.java             # Spring Security 필터 체인, 역할별 접근 제어
│   │   └── JwtAuthenticationFilter.java    # 매 요청 토큰 검증 (auth.infrastructure.JwtTokenProvider 사용)
│   └── batch
│       └── ...                             # Spring Batch 공통 설정
├── member                          # 로그인 계정(관리자/학생 공통) — 아직 자체 API 없이 다른 도메인이 참조만 함
│   └── domain
│       ├── Member.java
│       ├── MemberType.java                 # ADMIN | STUDENT
│       └── MemberRepository.java
├── auth
│   ├── domain
│   │   └── RefreshTokenRepository.java     # Redis 저장을 추상화하는 포트 인터페이스
│   ├── application
│   │   └── AuthService.java                # login / refresh / logout 유스케이스
│   ├── presentation
│   │   ├── AuthController.java
│   │   ├── LoginRequest.java / LoginResponse.java
│   │   └── RefreshRequest.java / RefreshResponse.java
│   └── infrastructure
│       ├── JwtTokenProvider.java           # JWT 발급/파싱
│       └── RedisRefreshTokenRepository.java   # domain.RefreshTokenRepository 구현체 (Redis)
├── question
│   ├── domain
│   │   ├── Question.java
│   │   ├── QuestionRepository.java
│   │   ├── QuestionType.java
│   │   ├── DifficultyLevel.java
│   │   └── QuestionStatus.java
│   ├── application
│   │   ├── QuestionService.java
│   │   └── QuestionGenerationService.java  # GPT 문제 생성 유스케이스
│   ├── presentation
│   │   ├── QuestionController.java
│   │   ├── QuestionRequest.java
│   │   └── QuestionResponse.java
│   └── infrastructure
│       └── GptQuestionClient.java          # GPT API 연동 구현체
├── assignment
│   ├── domain
│   │   ├── Assignment.java
│   │   ├── AssignmentRepository.java
│   │   └── AssignmentStatus.java
│   ├── application
│   │   └── AssignmentService.java
│   └── presentation
│       └── ...
├── student
│   ├── domain
│   │   ├── Student.java                    # member.domain.Member를 참조 (1:1)
│   │   └── StudentRepository.java
│   ├── application
│   │   └── StudentService.java
│   └── presentation
│       └── ...
├── studyrecord
│   ├── domain
│   │   ├── StudyRecord.java
│   │   └── StudyRecordRepository.java
│   ├── application
│   │   └── StudyRecordService.java
│   └── presentation
│       └── ...
└── wronganswer
    ├── domain
    │   ├── WrongAnswer.java
    │   └── WrongAnswerRepository.java
    ├── application
    │   └── WrongAnswerService.java
    └── presentation
        └── ...
```

기능이 늘어나 한 도메인 패키지가 비대해지면 그 도메인 안에서만 하위 패키지를 더 나누는 것을 검토하고, 최상위를 계층으로 다시 쪼개지는 않습니다. 아직 자체 API가 없는 도메인(`member`)처럼 필요 없는 계층(`application`/`presentation`)은 만들지 않고, 필요해지는 시점에 추가합니다.

### 의존 방향

같은 도메인 패키지 안에서는 기존과 동일하게 계층 순서를 지킵니다.

```
presentation → application → domain ← infrastructure
```

- `presentation`은 같은 도메인의 `application`만 호출하고, `domain`을 직접 조작하지 않습니다.
- `application`은 같은 도메인의 `domain` 엔티티·리포지토리 인터페이스를 사용해 유스케이스를 조합합니다. 여기에 비즈니스 규칙을 새로 만들지 않고, 이미 `domain`에 있는 동작을 호출/조합만 합니다.
- `domain`은 인프라를 참조하지 않습니다. 리포지토리는 `domain`에 **인터페이스**로 존재하고(Spring Data JPA 인터페이스 자체가 이 역할을 겸함), 실제 외부 연동이 필요한 것(GPT 클라이언트, Redis 등)은 `domain`에 인터페이스를, 같은 도메인의 `infrastructure`에 구현체를 둡니다. 예를 들어 refresh token은 RDB가 아닌 Redis에 저장하지만, `auth.application`은 `auth.domain.RefreshTokenRepository` 인터페이스만 알고 `auth.infrastructure.RedisRefreshTokenRepository` 구현을 직접 알지 못합니다 — GPT 클라이언트와 동일한 패턴입니다.
- `infrastructure`는 같은 도메인의 `domain` 인터페이스를 구현하거나 `application`에서 호출되는 어댑터 역할만 합니다.

도메인 간에는 규칙이 다릅니다.

- 다른 도메인을 참조할 때는 그 도메인의 `domain`(엔티티·리포지토리 인터페이스)까지만 참조합니다. 예: `student.domain.Student`가 `member.domain.Member`를 참조. `assignment.application`이 문제 존재 여부를 확인할 때 `question.domain.QuestionRepository`를 사용합니다.
- 다른 도메인의 `application`이나 `presentation`은 직접 호출하지 않습니다. (예: `assignment` 도메인이 `question.application.QuestionService`를 호출하지 않습니다.) 여러 도메인에 걸친 유스케이스가 필요하면 그 조합은 호출하는 쪽 도메인의 `application`에 둡니다.

### 도메인 모델 패턴 (Domain Model, not Anemic)

엔티티는 getter/setter만 가진 데이터 덩어리가 아니라, **자신의 상태를 스스로 바꾸는 행동을 가진 객체**로 만듭니다. 상태 전이·유효성 검증은 서비스가 아니라 엔티티 메서드 안에 둡니다.

```java
// question/domain/Question.java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Question {

    @Id @GeneratedValue
    private Long id;

    private String category;

    @Enumerated(EnumType.STRING)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    private DifficultyLevel level;

    @Enumerated(EnumType.STRING)
    private QuestionStatus status;

    private String text;
    private String answer;

    @Builder
    private Question(String category, QuestionType type, DifficultyLevel level,
                      String text, String answer) {
        this.category = category;
        this.type = type;
        this.level = level;
        this.text = text;
        this.answer = answer;
        this.status = QuestionStatus.DRAFT;
    }

    public void activate() {
        if (this.status == QuestionStatus.DISABLED) {
            throw new IllegalStateException("사용 중지된 문제는 바로 활성화할 수 없습니다.");
        }
        this.status = QuestionStatus.IN_USE;
    }

    public void disable() {
        this.status = QuestionStatus.DISABLED;
    }

    public boolean isCorrect(String submitted) {
        return this.answer.equals(submitted);
    }
}
```

서비스는 이 행동을 조합하기만 합니다.

```java
// question/application/QuestionService.java
@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;

    @Transactional
    public void activate(Long questionId) {
        Question question = questionRepository.findById(questionId)
            .orElseThrow(() -> new QuestionNotFoundException(questionId));
        question.activate();
    }
}
```

### 계정(Member)과 학생(Student)의 관계

로그인 가능한 계정은 `Member` 하나로 통일하고, `type`으로 관리자/학생을 구분합니다. 관리자는 `Member` 자체로 충분하고, 학생만 갖는 추가 정보(그룹, 학습 통계)는 `Student`가 `Member`를 참조하는 형태로 분리합니다.

```java
// member/domain/Member.java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member {

    @Id @GeneratedValue
    private Long id;

    private String loginId;
    private String password;   // 해시된 값만 저장
    private String name;

    @Enumerated(EnumType.STRING)
    private MemberType type;

    @Builder
    private Member(String loginId, String password, String name, MemberType type) {
        this.loginId = loginId;
        this.password = password;
        this.name = name;
        this.type = type;
    }

    public boolean isStudent() {
        return this.type == MemberType.STUDENT;
    }
}
```

```java
// student/domain/Student.java
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Student {

    @Id @GeneratedValue
    private Long id;

    @OneToOne
    @JoinColumn(name = "member_id")
    private Member member;

    private String group;

    // 이름은 student가 들고 있지 않고 member.getName()으로 조회한다.
}
```

## 네이밍

- 클래스: `PascalCase`, 계층별 접미사로 역할을 드러냅니다.
  - `domain`: 접미사 없이 도메인 용어 그대로 (`Question`, `Assignment`), 리포지토리는 `{Entity}Repository`
  - `application`: `{Domain}Service` (`QuestionService`), 유스케이스가 명확히 구분되면 `{Domain}{동사}Service`도 허용 (`QuestionGenerationService`)
  - `presentation`: `{Domain}Controller`, DTO는 `{Domain}Request`/`{Domain}Response`
  - `infrastructure`: 연동 대상이 드러나는 이름 (`GptQuestionClient`)
- 테스트 클래스: 대상 클래스명 + `Test` (예: `QuestionServiceTest`)
- Flyway 마이그레이션 파일(`backend/src/main/resources/db/migration`): `V{버전}__{설명}.sql` (예: `V1__create_question_table.sql`)

## Lombok

- 엔티티에는 `@Getter`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`를 우선 사용하고, `@Setter`와 `@Data`는 지양합니다. 상태 변경은 위 도메인 모델 패턴처럼 의도가 드러나는 메서드로만 합니다.
- 생성자는 `@Builder`(엔티티 생성) 또는 `@RequiredArgsConstructor`(서비스·컨트롤러의 의존성 주입)로 명시적으로 구성합니다.

## DTO ↔ 엔티티 변환

`presentation` 계층의 DTO(`{Domain}Request`/`{Domain}Response`)와 `domain` 엔티티 간 변환은 DTO 쪽(정적 팩토리 메서드 또는 별도 매퍼)에서 수행하고, 엔티티가 DTO를 알지 못하도록 합니다.
