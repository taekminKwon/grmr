FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN ./gradlew --version

COPY src ./src
RUN ./gradlew bootJar -x test --no-daemon && \
    mv build/libs/*.jar build/libs/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

RUN addgroup -S spring && adduser -S spring -G spring
COPY --from=build /workspace/build/libs/app.jar app.jar
USER spring:spring

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=5 \
    CMD nc -z localhost 8080 || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
