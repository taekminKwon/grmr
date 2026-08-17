package com.ewha_eng.grmr.studentassignment.application;

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
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
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
 * Runs the real Flyway migrations against the container instead of Hibernate DDL, matching how the
 * app runs against production Postgres.
 */
@Tag("integration")
@Testcontainers
@SpringBootTest
class StudentAssignmentServicePostgresIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void useRealFlywayMigrationInsteadOfHibernateDdl(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
    }

    @Autowired
    private StudentAssignmentService studentAssignmentService;

    @Autowired
    private AssignmentSubmissionRepository submissionRepository;

    @Autowired
    private MemberJpaRepository memberRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private AssignmentRepository assignmentRepository;

    @Autowired
    private EntityManager entityManager;

    @Test
    void saveAnswerDraft_createsSubmissionAndDraft_onFirstSave_andSurvivesPersistenceContextEviction() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = saveAssignment(List.of(question.getId()));

        AssignmentAnswerDraftResult result = studentAssignmentService.saveAnswerDraft(
            assignment.getId(), question.getId(), "since", student.getId());

        assertThat(result.questionId()).isEqualTo(question.getId());
        assertThat(result.answer()).isEqualTo("since");
        assertThat(result.savedAt()).isNotNull();

        entityManager.clear();
        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.answerFor(question.getId())).contains("since");
    }

    @Test
    void saveAnswerDraft_overwritesDraft_updatingSavedAt_andPersistsAcrossEviction() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = saveAssignment(List.of(question.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), question.getId(), "since", student.getId());
        entityManager.clear();

        AssignmentAnswerDraftResult result = studentAssignmentService.saveAnswerDraft(
            assignment.getId(), question.getId(), "for", student.getId());

        assertThat(result.answer()).isEqualTo("for");
        entityManager.clear();
        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.answeredQuestionCount()).isEqualTo(1);
        assertThat(reloaded.answerFor(question.getId())).contains("for");
    }

    @Test
    void saveAnswerDraft_concurrentFirstSave_createsExactlyOneSubmission_andLosesNeitherDraft() throws Exception {
        Member student = saveStudent();
        Question firstQuestion = saveQuestion();
        Question secondQuestion = saveQuestion();
        Assignment assignment = saveAssignment(List.of(firstQuestion.getId(), secondQuestion.getId()));

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Exception> firstFailure = new AtomicReference<>();
        AtomicReference<Exception> secondFailure = new AtomicReference<>();

        try {
            executor.submit(() -> {
                await(ready, start);
                try {
                    studentAssignmentService.saveAnswerDraft(
                        assignment.getId(), firstQuestion.getId(), "since", student.getId());
                } catch (Exception e) {
                    firstFailure.set(e);
                }
            });
            executor.submit(() -> {
                await(ready, start);
                try {
                    studentAssignmentService.saveAnswerDraft(
                        assignment.getId(), secondQuestion.getId(), "for", student.getId());
                } catch (Exception e) {
                    secondFailure.set(e);
                }
            });

            ready.await(5, TimeUnit.SECONDS);
            start.countDown();
            executor.shutdown();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        } finally {
            executor.shutdownNow();
        }

        assertThat(firstFailure.get()).isNull();
        assertThat(secondFailure.get()).isNull();

        List<AssignmentSubmission> submissions = submissionRepository.findAll().stream()
            .filter(submission -> submission.getAssignmentId().equals(assignment.getId()))
            .toList();
        assertThat(submissions).hasSize(1);

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.answerFor(firstQuestion.getId())).contains("since");
        assertThat(reloaded.answerFor(secondQuestion.getId())).contains("for");
    }

    private void await(CountDownLatch ready, CountDownLatch start) {
        ready.countDown();
        try {
            start.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private Member saveStudent() {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId("student-" + System.nanoTime())
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .studentGroup("중1 A반")
            .build());
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

    private Assignment saveAssignment(List<Long> questionIds) {
        return assignmentRepository.saveAndFlush(Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 31))
            .questionIds(questionIds)
            .build());
    }
}
