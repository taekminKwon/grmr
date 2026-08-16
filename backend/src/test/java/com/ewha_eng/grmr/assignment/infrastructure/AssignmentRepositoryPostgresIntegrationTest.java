package com.ewha_eng.grmr.assignment.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.time.LocalDate;
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
class AssignmentRepositoryPostgresIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void useRealFlywayMigrationInsteadOfHibernateDdl(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
    }

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Test
    void save_roundTripsOrderedQuestionsAndClassTarget_onFlywayManagedSchema() {
        Question first = saveQuestion();
        Question second = saveQuestion();
        Question third = saveQuestion();

        Assignment assignment = Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(third.getId(), first.getId(), second.getId()))
            .build();

        Long savedId = assignmentRepository.saveAndFlush(assignment).getId();
        assignmentRepository.flush();

        Assignment reloaded = assignmentRepository.findById(savedId).orElseThrow();

        assertThat(reloaded.getTargetType()).isEqualTo(AssignmentTargetType.CLASS);
        assertThat(reloaded.getTargetGroup()).isEqualTo("중1 A반");
        assertThat(reloaded.getTargetStudentId()).isNull();
        assertThat(reloaded.getQuestionIds())
            .containsExactly(third.getId(), first.getId(), second.getId());
    }

    @Test
    void save_roundTripsStudentTarget_referencingMember() {
        Member student = memberRepository.saveAndFlush(Member.builder()
            .loginId("student-" + System.nanoTime())
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build());
        Question question = saveQuestion();

        Assignment assignment = Assignment.builder()
            .title("개별 보충 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(student.getId())
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(question.getId()))
            .build();

        Assignment saved = assignmentRepository.saveAndFlush(assignment);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getTargetType()).isEqualTo(AssignmentTargetType.STUDENT);
        assertThat(saved.getTargetStudentId()).isEqualTo(student.getId());
        assertThat(saved.getTargetGroup()).isNull();
    }

    private Question saveQuestion() {
        return questionRepository.saveAndFlush(Question.builder()
            .category("현재완료")
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.INTERMEDIATE)
            .text("He has lived here _____ 2010.")
            .choices(List.of("for", "since", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build());
    }
}
