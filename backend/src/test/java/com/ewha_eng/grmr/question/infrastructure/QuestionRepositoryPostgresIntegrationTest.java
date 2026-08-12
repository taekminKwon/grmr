package com.ewha_eng.grmr.question.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Requires a local Docker daemon to pull and start the postgres:16.4 image via Testcontainers.
 * Runs the real Flyway migrations (spring.flyway.enabled defaults to true) against the container
 * and disables Hibernate schema generation, matching how the app runs against production Postgres.
 */
@Tag("integration")
@Testcontainers
@SpringBootTest
class QuestionRepositoryPostgresIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void useRealFlywayMigrationInsteadOfHibernateDdl(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
    }

    @Autowired
    private QuestionRepository questionRepository;

    @Test
    void save_generatesId_onFlywayManagedBigserialSchema() {
        Question question = Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.BASIC)
            .text("사과를 고르는 문제")
            .choices(List.of("a", "b"))
            .answer("a")
            .explanation("해설")
            .build();

        Question saved = questionRepository.saveAndFlush(question);

        assertThat(saved.getId()).isNotNull();
    }
}
