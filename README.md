# Grammar Lab (grmr)

영문법 문제 풀이 및 학습 관리 서비스입니다. 관리자(교사)가 문제·과제를 관리하고 학생 학습 현황을 모니터링하며, 학생은 과제를 풀고 자신의 학습 이력·오답을 관리합니다.

기능 상세는 [docs/feature-spec.md](docs/feature-spec.md), API 설계는 [docs/api-spec.md](docs/api-spec.md)를 참고하세요.

## 저장소 구조

이 저장소는 백엔드와 프론트엔드를 함께 담는 모노레포입니다.

```
.
├── backend/       # Spring Boot API 서버
├── frontend/      # (예정)
├── docs/          # 기능/API/컨벤션 문서
└── sample-html/   # 초기 UI 와이어프레임 (클릭형 프로토타입)
```

## 기술 스택 (backend)

- Java 21, Spring Boot 4.1.0, Gradle
- Spring Web MVC, Spring Data JPA, Spring Batch, Flyway
- PostgreSQL

## 시작하기

```bash
cd backend
./gradlew bootRun    # 로컬 실행
./gradlew test        # 테스트 실행
./gradlew build       # 빌드
```

## 문서

- [기능 명세](docs/feature-spec.md)
- [API 명세](docs/api-spec.md) / [API 상세 명세](docs/api-spec-detail.md)
- [Git 컨벤션](docs/git-convention.md)
- [코드 컨벤션 (backend)](docs/code-convention.md)
