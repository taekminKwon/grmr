# 코드 컨벤션 (backend)

`auth`, `member` 도메인에 실제 코드가 존재하고(`question`/`assignment`/`student`/`studyrecord`/`wronganswer`는 아직 없음), 이 문서는 그 코드에서 확립한 패턴을 기준으로 합니다. 새 도메인을 추가할 때는 여기 있는 구조와 네이밍을 따르고, 기존 패턴과 다르게 가야 할 이유가 생기면 코드와 함께 이 문서도 갱신합니다.

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
│   ├── domain
│   │   ├── Member.java
│   │   ├── MemberType.java                 # ADMIN | STUDENT
│   │   └── MemberReader.java                # 조회 포트 인터페이스 (기술 비의존)
│   └── infrastructure
│       └── MemberJpaRepository.java         # extends JpaRepository<Member, Long>, MemberReader — DB 기술 구현체
├── auth
│   ├── domain
│   │   ├── RefreshTokenReader.java          # 조회 포트 인터페이스
│   │   └── RefreshTokenStore.java           # 저장/삭제 포트 인터페이스 (Redis 등 저장소를 추상화)
│   ├── application
│   │   └── AuthService.java                # login / refresh / logout 유스케이스
│   ├── presentation
│   │   ├── AuthController.java
│   │   ├── LoginRequest.java / LoginResponse.java
│   │   └── RefreshRequest.java / RefreshResponse.java
│   └── infrastructure
│       ├── JwtTokenProvider.java           # JWT 발급/파싱
│       └── RedisRefreshTokenRepository.java   # domain.RefreshTokenReader/Store 구현체 (Redis) — DB(캐시) 기술 구현체
├── question
│   ├── domain
│   │   ├── Question.java
│   │   ├── QuestionReader.java              # 조회 포트 인터페이스
│   │   ├── QuestionStore.java               # 저장/삭제 포트 인터페이스
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
│       ├── QuestionJpaRepository.java       # extends JpaRepository<Question, Long>, QuestionReader, QuestionStore — DB 기술 구현체
│       └── GptQuestionClient.java          # GPT API 연동 구현체
├── assignment
│   ├── domain
│   │   ├── Assignment.java
│   │   ├── AssignmentReader.java
│   │   ├── AssignmentStore.java
│   │   └── AssignmentStatus.java
│   ├── application
│   │   └── AssignmentService.java
│   ├── presentation
│   │   └── ...
│   └── infrastructure
│       └── AssignmentJpaRepository.java
├── student
│   ├── domain
│   │   ├── Student.java                    # member.domain.Member를 참조 (1:1)
│   │   ├── StudentReader.java
│   │   └── StudentStore.java
│   ├── application
│   │   └── StudentService.java
│   ├── presentation
│   │   └── ...
│   └── infrastructure
│       └── StudentJpaRepository.java
├── studyrecord
│   ├── domain
│   │   ├── StudyRecord.java
│   │   ├── StudyRecordReader.java
│   │   └── StudyRecordStore.java
│   ├── application
│   │   └── StudyRecordService.java
│   ├── presentation
│   │   └── ...
│   └── infrastructure
│       └── StudyRecordJpaRepository.java
└── wronganswer
    ├── domain
    │   ├── WrongAnswer.java
    │   ├── WrongAnswerReader.java
    │   └── WrongAnswerStore.java
    ├── application
    │   └── WrongAnswerService.java
    ├── presentation
    │   └── ...
    └── infrastructure
        └── WrongAnswerJpaRepository.java
```

기능이 늘어나 한 도메인 패키지가 비대해지면 그 도메인 안에서만 하위 패키지를 더 나누는 것을 검토하고, 최상위를 계층으로 다시 쪼개지는 않습니다. 아직 자체 API가 없는 도메인(`member`)처럼 필요 없는 계층(`application`/`presentation`)은 만들지 않고, 필요해지는 시점에 추가합니다.

### 의존 방향과 DIP

같은 도메인 패키지 안에서는 기존과 동일하게 계층 순서를 지킵니다.

```
presentation → application → domain ← infrastructure
```

- `presentation`은 같은 도메인의 `application`만 호출하고, `domain`을 직접 조작하지 않습니다.
- `application`은 같은 도메인의 `domain` 엔티티·포트 인터페이스(`Reader`/`Store`, 아래 참고)를 사용해 유스케이스를 조합합니다. 여기에 비즈니스 규칙을 새로 만들지 않고, 이미 `domain`에 있는 동작을 호출/조합만 합니다. **`application`은 `infrastructure`의 구현 클래스를 절대 import하지 않고, 생성자 주입 필드도 항상 `domain`의 인터페이스 타입으로 선언합니다** — 이것이 이 프로젝트에서 DIP(의존성 역전 원칙)를 지키는 방법입니다. 고수준 모듈(`application`)이 저수준 모듈(`infrastructure`)에 의존하는 게 아니라, 둘 다 `domain`에 있는 추상화(포트 인터페이스)에 의존하고 스프링 DI 컨테이너가 런타임에 실제 구현체를 주입합니다.
- `domain`은 인프라를 참조하지 않습니다. 영속성이 필요한 포트는 `domain`에 **인터페이스**로 존재하고(아래 "포트 네이밍" 참고), 실제 외부 연동이 필요한 것(JPA, Redis, GPT 클라이언트 등)은 `domain`에 인터페이스를, 같은 도메인의 `infrastructure`에 구현체를 둡니다. 예를 들어 refresh token은 RDB가 아닌 Redis에 저장하지만, `auth.application`은 `auth.domain.RefreshTokenReader`/`RefreshTokenStore` 인터페이스만 알고 `auth.infrastructure.RedisRefreshTokenRepository` 구현을 직접 알지 못합니다 — GPT 클라이언트와 동일한 패턴입니다.
- `infrastructure`는 두 가지 역할만 합니다: **(1) DB 레이어** — Spring Data JPA 인터페이스, `JdbcTemplate` 사용 코드 등 영속성 기술 구현체, **(2) 기술 구현체** — Redis, 외부 API 클라이언트(GPT 등), 메시징 클라이언트처럼 `domain` 포트 인터페이스를 구현하는 어댑터. 그 외의 책임(비즈니스 규칙 조합 등)은 두지 않습니다.

도메인 간에는 규칙이 다릅니다.

- 다른 도메인을 참조할 때는 그 도메인의 `domain`(엔티티·포트 인터페이스)까지만 참조합니다. 예: `student.domain.Student`가 `member.domain.Member`를 참조. `assignment.application`이 문제 존재 여부를 확인할 때 `question.domain.QuestionReader`를 사용합니다.
- 다른 도메인의 `application`이나 `presentation`은 직접 호출하지 않습니다. (예: `assignment` 도메인이 `question.application.QuestionService`를 호출하지 않습니다.) 여러 도메인에 걸친 유스케이스가 필요하면 그 조합은 호출하는 쪽 도메인의 `application`에 둡니다.

### 포트 네이밍: `Repository` 대신 `Reader`/`Store`

`domain` 계층의 영속성 포트 인터페이스 이름에는 **`Repository`를 쓰지 않습니다.** Spring Data JPA의 `JpaRepository`/`Repository`와 이름이 같으면 "이 인터페이스는 Spring Data가 자동 구현해준다"는 착각을 일으키기 쉽고, `domain.XxxRepository`가 실제로는 Redis나 인메모리 구현체를 가리키는 경우(`RefreshTokenReader`/`Store`처럼) 혼란이 커집니다. 대신 역할을 그대로 드러내는 이름을 씁니다.

- `{Entity}Reader`: 조회 전용 포트. 조회 메서드만 선언합니다.
- `{Entity}Store`: 저장/수정/삭제 포트. 쓰기 메서드만 선언합니다.

읽기/쓰기를 분리하는 이유는 [ISP(인터페이스 분리 원칙)](#isp-인터페이스-분리-원칙) 때문입니다 — 조회만 필요한 소비자가 저장/삭제 메서드까지 의존하지 않도록 합니다. 다만 **실제로 쓰기가 필요해지기 전까지 `{Entity}Store`를 미리 만들지 않습니다.** 예를 들어 `member` 도메인은 아직 회원가입 유스케이스가 없어 `MemberReader`만 존재하고, `MemberStore`는 쓰기 유스케이스가 생길 때 추가합니다.

구현체는 기술에 따라 두 가지 형태를 씁니다.

**(1) Spring Data JPA로 구현 가능한 경우** — 별도 어댑터 클래스를 만들지 않고, `infrastructure`의 Spring Data 인터페이스가 `domain`의 포트 인터페이스를 직접 extends해서 Spring이 런타임에 함께 구현하게 합니다.

```java
// member/domain/MemberReader.java — 기술에 의존하지 않는 순수 포트
package com.ewha_eng.grmr.member.domain;

import java.util.Optional;

public interface MemberReader {
    Optional<Member> findById(Long id);
    Optional<Member> findByLoginId(String loginId);
}
```

```java
// member/infrastructure/MemberJpaRepository.java — DB 기술 구현체
package com.ewha_eng.grmr.member.infrastructure;

import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberReader;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberJpaRepository extends JpaRepository<Member, Long>, MemberReader {
}
```

`application`은 `MemberReader` 타입으로만 주입받고, Spring이 `MemberJpaRepository` 빈을 그 자리에 넣어줍니다.

**(2) Spring Data가 아닌 기술(Redis, 외부 API 등)인 경우** — `infrastructure`에 포트 인터페이스를 구현하는 어댑터 클래스를 직접 작성합니다. (기존 `RedisRefreshTokenRepository`가 이 패턴입니다. 이 클래스 자체는 `infrastructure`에 있으므로 이름에 `Repository`가 남아 있어도 "Spring Data가 자동 구현"이라는 착각을 일으키지 않습니다 — 혼동을 막아야 하는 지점은 어디까지나 `domain` 계층입니다.)

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
        this.status = QuestionStatus.ACTIVE;
    }

    public void deactivate() {
        if (this.status == QuestionStatus.DRAFT) {
            throw new InvalidStatusTransitionException("초안 상태에서는 사용 중지로 변경할 수 없습니다.");
        }
        this.status = QuestionStatus.INACTIVE;
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

    private final QuestionReader questionReader;

    @Transactional
    public void activate(Long questionId) {
        Question question = questionReader.findById(questionId)
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

## 서비스 응집도: Facade, Strategy, Template Method

서비스가 처음부터 복잡할 필요는 없습니다. 위 `QuestionService` 예시처럼 포트 하나를 호출해 유스케이스 하나를 구현하는 수준이면 그대로 둡니다. 아래 패턴들은 **실제로 아래 징후가 나타났을 때** 도입을 검토하는 것이지, 도메인을 새로 만들 때 미리 깔아두는 게 아닙니다.

- **여러 도메인 서비스를 한 유스케이스에서 조합해야 할 때 → Facade**
  하나의 컨트롤러 액션이 서로 다른 도메인의 서비스 2개 이상을 순서대로 호출하고 그 결과를 엮어야 하는 경우, `presentation`이 여러 `application`을 직접 호출하게 두지 않고 조합 전용 `{UseCase}Facade`를 둡니다. 예를 들어 "과제 제출 채점"이 `question.application.QuestionService`(정답 확인)와 `wronganswer.application.WrongAnswerService`(오답 기록)와 `studyrecord.application.StudyRecordService`(학습 기록 갱신)를 순서대로 호출해야 한다면, 이 조합 로직을 `assignment.application.AssignmentGradingFacade`에 두고 각 도메인 서비스를 주입받아 순서대로 호출합니다. Facade 자체는 새 비즈니스 규칙을 만들지 않고 오케스트레이션만 합니다.

- **한 서비스 안에서 조건 분기가 늘어나며 로직이 얽힐 때 → Strategy**
  예를 들어 `QuestionGenerationService`가 문제 유형(`QuestionType`)별로 GPT 프롬프트 구성과 응답 파싱 방식이 크게 달라 `if/switch`가 늘어난다면, 유형별 로직을 `QuestionGenerationStrategy` 인터페이스로 뽑고 유형마다 구현체(`GrammarQuestionGenerationStrategy`, `VocabQuestionGenerationStrategy` 등)를 만듭니다. 서비스는 `QuestionType`에 맞는 전략을 선택해 위임만 합니다. `if/switch`가 새 케이스마다 여러 메서드에서 반복해서 늘어나는 것이 신호입니다.

- **여러 구현체가 같은 절차를 공유하되 일부 단계만 다를 때 → Template Method**
  예를 들어 채점 로직이 문제 유형과 무관하게 "정답 조회 → 채점 → 오답이면 기록 → 결과 반환"이라는 동일한 절차를 따르고 유형별로 "채점" 단계만 다르다면, 추상 클래스에 절차를 고정하고 채점 단계만 하위 클래스가 구현하게 합니다. Strategy와의 구분 기준: 단계 전체가 다르면 Strategy, 절차는 같고 일부 단계만 다르면 Template Method입니다.

이 패턴들을 도입할 때도 의존 방향은 그대로 지킵니다 — 전략/템플릿 구현체는 여전히 해당 도메인의 `application`(또는 `domain`, 순수 규칙이면) 안에 위치하고, `domain` 포트 인터페이스에 대한 의존은 [DIP](#의존-방향과-dip) 규칙을 따릅니다.

### ISP: 인터페이스 분리 원칙

소비자가 쓰지 않는 메서드에 의존하지 않도록 인터페이스를 필요한 단위로 쪼갭니다. 이 프로젝트에서 가장 흔하게 나타나는 형태가 [`{Entity}Reader`/`{Entity}Store` 분리](#포트-네이밍-repository-대신-readerstore)입니다 — 조회만 하는 소비자가 저장/삭제 메서드까지 함께 의존하지 않게 합니다. 같은 원칙을 포트 인터페이스 밖에서도 적용합니다: 하나의 인터페이스에 서로 다른 소비자가 쓰는 메서드가 섞여 늘어나면(예: 관리자 전용 메서드와 학생 전용 메서드가 한 인터페이스에 공존), 소비자 기준으로 인터페이스를 나누는 것을 검토합니다. 다만 ISP도 위 Facade/Strategy와 마찬가지로 실제로 소비자가 갈릴 때 적용하는 것이지, 메서드 하나짜리 인터페이스를 미리 남발하지 않습니다.

## 네이밍

- 클래스: `PascalCase`, 계층별 접미사로 역할을 드러냅니다.
  - `domain`: 접미사 없이 도메인 용어 그대로 (`Question`, `Assignment`), 영속성 포트는 `{Entity}Reader`/`{Entity}Store` (`Repository` 금지 — 이유는 [포트 네이밍](#포트-네이밍-repository-대신-readerstore) 참고)
  - `application`: `{Domain}Service` (`QuestionService`), 유스케이스가 명확히 구분되면 `{Domain}{동사}Service`도 허용 (`QuestionGenerationService`). 여러 서비스를 조합해야 하면 `{Domain}Facade` (아래 [서비스 응집도](#서비스-응집도-facade-strategy-template-method) 참고)
  - `presentation`: `{Domain}Controller`, DTO는 `{Domain}Request`/`{Domain}Response`
  - `infrastructure`: DB 기술 구현체는 `{Entity}JpaRepository`, 그 외 연동 대상이 드러나는 이름 (`GptQuestionClient`, `RedisRefreshTokenRepository`)
- 테스트 클래스: 대상 클래스명 + `Test` (예: `QuestionServiceTest`)
- Flyway 마이그레이션 파일(`backend/src/main/resources/db/migration`): `V{버전}__{설명}.sql` (예: `V1__create_question_table.sql`)

## Lombok

- 엔티티에는 `@Getter`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`를 우선 사용하고, `@Setter`와 `@Data`는 지양합니다. 상태 변경은 위 도메인 모델 패턴처럼 의도가 드러나는 메서드로만 합니다.
- 생성자는 `@Builder`(엔티티 생성) 또는 `@RequiredArgsConstructor`(서비스·컨트롤러의 의존성 주입)로 명시적으로 구성합니다.

## DTO ↔ 엔티티 변환

`presentation` 계층의 DTO(`{Domain}Request`/`{Domain}Response`)와 `domain` 엔티티 간 변환은 DTO 쪽(정적 팩토리 메서드 또는 별도 매퍼)에서 수행하고, 엔티티가 DTO를 알지 못하도록 합니다.
