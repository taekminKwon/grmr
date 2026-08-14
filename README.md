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

## 로컬 배포 (Docker Compose)

`scripts/deploy-local.sh`는 로컬에서 `docker compose`로 전체 스택(postgres, redis, backend, frontend)을 빌드·기동하는 단일 진입점입니다. 저장소 루트를 스크립트 위치 기준으로 자동 탐색하므로 어느 디렉터리에서, 어느 git worktree에서 실행해도 동일하게 동작합니다.

```bash
# 기본: <repo-root>/.env 사용
scripts/deploy-local.sh

# worktree에서 메인 저장소의 .env를 재사용하는 경우
scripts/deploy-local.sh /Users/you/Desktop/ewha-grmr/.env
```

- 프로젝트 이름은 `infra-compose`로 고정됩니다.
- Docker, `docker compose`, `compose.yaml`, env 파일 중 하나라도 없으면 즉시 에러를 출력하고 종료합니다.
- 배포 대상 브랜치/커밋만 출력하며 env 파일 내용은 출력하지 않습니다.
- 빌드 → detached 기동 → orphan 컨테이너 정리 → bounded health wait(`--wait`) 순서로 실행되고, 마지막에 `docker compose ps` 결과를 출력합니다.
- 볼륨 삭제/prune 등 파괴적 동작은 수행하지 않습니다.

문법 검증(도커 미실행)은 `scripts/check-deploy-local.sh`로 수행할 수 있습니다.

## 문서

- [기능 명세](docs/feature-spec.md)
- [API 명세](docs/api-spec.md) / [API 상세 명세](docs/api-spec-detail.md)
- [Git 컨벤션](docs/git-convention.md)
- [코드 컨벤션 (backend)](docs/code-convention.md)
