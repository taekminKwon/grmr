package com.ewha_eng.grmr.studentassignment.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
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
class AssignmentSubmissionPostgresIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void useRealFlywayMigrationInsteadOfHibernateDdl(DynamicPropertyRegistry registry) {
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        registry.add("spring.flyway.enabled", () -> "true");
    }

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
    void save_roundTripsSubmission_onFlywayManagedSchema_withMemberAndAssignmentForeignKeys() {
        Member student = saveStudent();
        Assignment assignment = saveAssignment();

        AssignmentSubmission saved = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
    }

    @Test
    void databaseUniqueConstraint_rejectsSecondSubmission_forSameAssignmentAndStudent() {
        Member student = saveStudent();
        Assignment assignment = saveAssignment();
        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        assertThatThrownBy(() -> submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now())))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @Transactional
    void databaseUniqueConstraint_rejectsSecondDraft_forSameSubmissionAndQuestion() {
        Member student = saveStudent();
        Assignment assignment = saveAssignment();
        Question question = saveQuestion();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        // Insert directly via SQL (bypassing the aggregate's in-memory duplicate check) to prove
        // the DB constraint itself, not just application logic, prevents duplicate draft rows.
        insertDraft(submission.getId(), question.getId(), "since");

        assertThatThrownBy(() -> insertDraft(submission.getId(), question.getId(), "for"))
            .isInstanceOf(PersistenceException.class);
    }

    private void insertDraft(Long submissionId, Long questionId, String answer) {
        entityManager.createNativeQuery(
                "insert into assignment_answer_draft (submission_id, question_id, answer, saved_at) "
                    + "values (:submissionId, :questionId, :answer, :savedAt)")
            .setParameter("submissionId", submissionId)
            .setParameter("questionId", questionId)
            .setParameter("answer", answer)
            .setParameter("savedAt", LocalDateTime.now())
            .executeUpdate();
        entityManager.flush();
    }

    @Test
    void draftAnswer_survivesPersistenceContextEviction_asRealPersistedDataNotACache() {
        Member student = saveStudent();
        Assignment assignment = saveAssignment();
        Question question = saveQuestion();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));
        submission.upsertDraft(question.getId(), "since", LocalDateTime.now());
        submissionRepository.saveAndFlush(submission);

        // Simulate a restart: drop the persistence context so the next read hits the database.
        entityManager.clear();

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.answerFor(question.getId())).contains("since");
    }

    @Test
    void countByAssignmentIdAndStatus_reflectsOnlySubmittedRows_afterEviction() {
        Assignment assignment = saveAssignment();
        Member submittedStudent = saveStudent();
        Member inProgressStudent = saveStudent();
        AssignmentSubmission submitted = AssignmentSubmission.start(assignment.getId(), submittedStudent.getId(),
            LocalDateTime.now());
        submitted.submit(LocalDateTime.now());
        submissionRepository.saveAndFlush(submitted);
        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), inProgressStudent.getId(), LocalDateTime.now()));
        entityManager.clear();

        long submittedCount = submissionRepository
            .countByAssignmentIdAndStatus(assignment.getId(), SubmissionStatus.SUBMITTED);

        assertThat(submittedCount).isEqualTo(1);
    }

    private Member saveStudent() {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId("student-" + System.nanoTime())
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
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

    private Assignment saveAssignment() {
        Question question = saveQuestion();
        return assignmentRepository.saveAndFlush(Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 31))
            .questionIds(List.of(question.getId()))
            .build());
    }
}
