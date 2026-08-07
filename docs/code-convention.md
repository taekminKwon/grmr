# 코드 컨벤션

아직 실제 도메인 코드가 거의 없는 초기 단계라(`GrmrApplication`, `GrmrApplicationTests`만 존재) 히스토리에서 끌어올 만한 확립된 패턴이 없습니다. 이 문서는 `build.gradle`에 명시된 스택을 기준으로 한 시작점이며, 코드가 쌓이면 실제 코드에 맞춰 갱신해야 합니다.

## 패키지 구조

루트 패키지는 `com.ewha_eng.grmr`입니다. 계층(layer) 기준으로 하위 패키지를 나눕니다.

```
com.ewha_eng.grmr
├── controller   # REST 엔드포인트
├── service      # 비즈니스 로직
├── repository   # Spring Data JPA 리포지토리
├── domain       # JPA 엔티티
├── dto          # 요청/응답 DTO
└── batch        # Spring Batch Job/Step 설정
```

기능(도메인)이 늘어나 패키지가 복잡해지면 `domain/{기능명}` 하위에 계층을 두는 방식으로 전환을 검토하세요.

## 네이밍

- 클래스: `PascalCase`, 역할이 드러나는 접미사 사용 (`UserController`, `UserService`, `UserRepository`, `User`, `UserRequest`/`UserResponse`)
- 테스트 클래스: 대상 클래스명 + `Test` (예: `UserServiceTest`)
- Flyway 마이그레이션 파일(`src/main/resources/db/migration`): `V{버전}__{설명}.sql` (예: `V1__create_user_table.sql`)

## Lombok

- 엔티티에는 `@Getter`, `@NoArgsConstructor(access = AccessLevel.PROTECTED)`를 우선 사용하고, `@Setter`와 `@Data`는 지양합니다 (의도치 않은 상태 변경 방지).
- 생성자는 `@Builder` 또는 `@RequiredArgsConstructor`로 명시적으로 구성합니다.

## 계층 간 의존 방향

`controller → service → repository` 방향만 허용합니다. `repository`나 `domain`이 `service`/`controller`를 참조하지 않도록 합니다. DTO ↔ 엔티티 변환은 `service` 계층에서 수행합니다.
