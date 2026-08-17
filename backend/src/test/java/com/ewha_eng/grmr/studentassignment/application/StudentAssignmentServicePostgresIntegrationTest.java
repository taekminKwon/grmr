package com.ewha_eng.grmr.studentassignment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.member.infrastructure.MemberJpaRepository;
import com.ewha_eng.grmr.question.application.QuestionService;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentAlreadySubmittedException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentClosedException;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecord;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordStore;
import com.ewha_eng.grmr.studyrecord.domain.StudyRecordType;
import com.ewha_eng.grmr.studyrecord.infrastructure.StudyRecordJpaRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
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

    @Autowired
    private StudyRecordJpaRepository studyRecordRepository;

    @Autowired
    private QuestionService questionService;

    @Autowired
    private StudyRecordStore studyRecordStore;

    @TestConfiguration
    static class FailingStudyRecordStoreConfig {

        @Bean
        @Primary
        StudyRecordStore failAfterNStudyRecordStore(StudyRecordJpaRepository delegate) {
            return new FailAfterNStudyRecordStore(delegate);
        }
    }

    /**
     * Wraps the real Postgres-backed repository so a test can force a failure once a chosen
     * number of real saves have gone through, without giving up the real transaction/repository.
     */
    static class FailAfterNStudyRecordStore implements StudyRecordStore {

        private final StudyRecordJpaRepository delegate;
        private final AtomicInteger saveCount = new AtomicInteger();
        private volatile int failAfterSaveCount = -1;

        FailAfterNStudyRecordStore(StudyRecordJpaRepository delegate) {
            this.delegate = delegate;
        }

        void failAfter(int saveCountThreshold) {
            saveCount.set(0);
            failAfterSaveCount = saveCountThreshold;
        }

        void reset() {
            failAfterSaveCount = -1;
            saveCount.set(0);
        }

        @Override
        public StudyRecord save(StudyRecord studyRecord) {
            StudyRecord saved = ((StudyRecordStore) delegate).save(studyRecord);
            if (saveCount.incrementAndGet() == failAfterSaveCount) {
                throw new SimulatedStudyRecordFailure();
            }
            return saved;
        }
    }

    static class SimulatedStudyRecordFailure extends RuntimeException {

        SimulatedStudyRecordFailure() {
            super("Simulated failure injected for rollback test");
        }
    }

    @AfterEach
    void resetFailureInjection() {
        if (studyRecordStore instanceof FailAfterNStudyRecordStore failing) {
            failing.reset();
        }
    }

    @Test
    void submit_gradesAllCorrect_createsOneStudyRecordPerQuestion_withAssignmentReference_andLocksSubmission() {
        Member student = saveStudent();
        Question first = saveQuestion();
        Question second = saveQuestion();
        Assignment assignment = saveAssignment(List.of(first.getId(), second.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), first.getId(), "since", student.getId());
        studentAssignmentService.saveAnswerDraft(assignment.getId(), second.getId(), "since", student.getId());

        AssignmentSubmissionResult result = studentAssignmentService.submit(assignment.getId(), student.getId());

        assertThat(result.assignmentId()).isEqualTo(assignment.getId());
        assertThat(result.totalQuestions()).isEqualTo(2);
        assertThat(result.answeredQuestions()).isEqualTo(2);
        assertThat(result.correctCount()).isEqualTo(2);
        assertThat(result.score()).isEqualTo(100);
        assertThat(result.results()).hasSize(2);
        assertThat(result.results()).allSatisfy(item -> {
            assertThat(item.correct()).isTrue();
            assertThat(item.submittedAnswer()).isEqualTo("since");
            assertThat(item.correctAnswer()).isEqualTo("since");
        });

        entityManager.clear();
        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
        assertThat(reloaded.getSubmittedAt()).isNotNull();

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).hasSize(2);
        assertThat(records).allSatisfy(record -> {
            assertThat(record.getType()).isEqualTo(StudyRecordType.ASSIGNMENT);
            assertThat(record.isCorrect()).isTrue();
            assertThat(record.getMember().getId()).isEqualTo(student.getId());
        });
    }

    @Test
    void submit_gradesMixedAnswers_marksUnansweredQuestionsAsIncorrectWithNullAnswer() {
        Member student = saveStudent();
        Question answeredCorrectly = saveQuestion();
        Question answeredIncorrectly = saveQuestion();
        Question unanswered = saveQuestion();
        Assignment assignment = saveAssignment(
            List.of(answeredCorrectly.getId(), answeredIncorrectly.getId(), unanswered.getId()));
        studentAssignmentService.saveAnswerDraft(
            assignment.getId(), answeredCorrectly.getId(), "since", student.getId());
        studentAssignmentService.saveAnswerDraft(
            assignment.getId(), answeredIncorrectly.getId(), "for", student.getId());

        AssignmentSubmissionResult result = studentAssignmentService.submit(assignment.getId(), student.getId());

        assertThat(result.totalQuestions()).isEqualTo(3);
        assertThat(result.answeredQuestions()).isEqualTo(2);
        assertThat(result.correctCount()).isEqualTo(1);
        assertThat(result.score()).isEqualTo(33);
        assertThat(result.results().get(0).questionId()).isEqualTo(answeredCorrectly.getId());
        assertThat(result.results().get(0).correct()).isTrue();
        assertThat(result.results().get(1).questionId()).isEqualTo(answeredIncorrectly.getId());
        assertThat(result.results().get(1).correct()).isFalse();
        assertThat(result.results().get(1).submittedAnswer()).isEqualTo("for");
        assertThat(result.results().get(2).questionId()).isEqualTo(unanswered.getId());
        assertThat(result.results().get(2).correct()).isFalse();
        assertThat(result.results().get(2).submittedAnswer()).isNull();

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).hasSize(3);
        StudyRecord unansweredRecord = records.stream()
            .filter(record -> record.getQuestion().getId().equals(unanswered.getId()))
            .findFirst().orElseThrow();
        assertThat(unansweredRecord.getSubmittedAnswer()).isNull();
        assertThat(unansweredRecord.isCorrect()).isFalse();
    }

    @Test
    void submit_succeeds_withZeroAnswers_whenSubmissionNeverStarted() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = saveAssignment(List.of(question.getId()));

        AssignmentSubmissionResult result = studentAssignmentService.submit(assignment.getId(), student.getId());

        assertThat(result.totalQuestions()).isEqualTo(1);
        assertThat(result.answeredQuestions()).isZero();
        assertThat(result.correctCount()).isZero();
        assertThat(result.score()).isZero();
        assertThat(result.results().get(0).submittedAnswer()).isNull();
        assertThat(result.results().get(0).correct()).isFalse();

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
    }

    @Test
    void submit_snapshotStaysImmutable_afterOriginalQuestionIsLaterUpdated() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = saveAssignment(List.of(question.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), question.getId(), "since", student.getId());
        studentAssignmentService.submit(assignment.getId(), student.getId());

        questionService.update(question.getId(), null, null, null, "changed text", null, "for",
            "changed explanation");
        entityManager.clear();

        StudyRecord record = studyRecordRepository.findAll().stream()
            .filter(candidate -> assignment.getId().equals(candidate.getAssignmentId()))
            .findFirst().orElseThrow();
        assertThat(record.getText()).isEqualTo("He has lived here _____ 2010.");
        assertThat(record.getCorrectAnswer()).isEqualTo("since");
        assertThat(record.getExplanation()).isEqualTo("해설");
    }

    @Test
    void submit_throws_whenAssignmentIsClosed_andCreatesNoStudyRecords() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = assignmentRepository.saveAndFlush(Assignment.builder()
            .title("마감된 과제")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.now().minusDays(10))
            .dueDate(LocalDate.now().minusDays(1))
            .questionIds(List.of(question.getId()))
            .build());

        assertThatThrownBy(() -> studentAssignmentService.submit(assignment.getId(), student.getId()))
            .isInstanceOf(AssignmentClosedException.class);

        assertThat(studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId())))
            .isEmpty();
    }

    @Test
    void submit_throws_whenStudentIsNotTargeted() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = assignmentRepository.saveAndFlush(Assignment.builder()
            .title("다른 반 과제")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중2 B반")
            .startDate(LocalDate.now().minusDays(1))
            .dueDate(LocalDate.now().plusDays(10))
            .questionIds(List.of(question.getId()))
            .build());

        assertThatThrownBy(() -> studentAssignmentService.submit(assignment.getId(), student.getId()))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void submit_secondAttempt_afterAlreadySubmitted_createsNoAdditionalStudyRecords() {
        Member student = saveStudent();
        Question question = saveQuestion();
        Assignment assignment = saveAssignment(List.of(question.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), question.getId(), "since", student.getId());
        studentAssignmentService.submit(assignment.getId(), student.getId());

        assertThatThrownBy(() -> studentAssignmentService.submit(assignment.getId(), student.getId()))
            .isInstanceOf(AssignmentAlreadySubmittedException.class);

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).hasSize(1);
    }

    @Test
    void submit_concurrentDoubleSubmit_producesExactlyOneSuccess_andExactlyOneStudyRecordSetPerQuestion()
        throws Exception {
        Member student = saveStudent();
        Question first = saveQuestion();
        Question second = saveQuestion();
        Assignment assignment = saveAssignment(List.of(first.getId(), second.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), first.getId(), "since", student.getId());
        studentAssignmentService.saveAnswerDraft(assignment.getId(), second.getId(), "since", student.getId());

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<AssignmentSubmissionResult> firstSuccess = new AtomicReference<>();
        AtomicReference<Exception> firstFailure = new AtomicReference<>();
        AtomicReference<AssignmentSubmissionResult> secondSuccess = new AtomicReference<>();
        AtomicReference<Exception> secondFailure = new AtomicReference<>();

        try {
            executor.submit(() -> {
                await(ready, start);
                try {
                    firstSuccess.set(studentAssignmentService.submit(assignment.getId(), student.getId()));
                } catch (Exception e) {
                    firstFailure.set(e);
                }
            });
            executor.submit(() -> {
                await(ready, start);
                try {
                    secondSuccess.set(studentAssignmentService.submit(assignment.getId(), student.getId()));
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

        long successCount = (firstSuccess.get() != null ? 1 : 0) + (secondSuccess.get() != null ? 1 : 0);
        long conflictCount = (firstFailure.get() instanceof AssignmentAlreadySubmittedException ? 1 : 0)
            + (secondFailure.get() instanceof AssignmentAlreadySubmittedException ? 1 : 0);
        assertThat(successCount).isEqualTo(1);
        assertThat(conflictCount).isEqualTo(1);

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).hasSize(2);

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
    }

    @Test
    void submit_concurrentDoubleSubmit_withNoPriorSubmissionOrDrafts_producesExactlyOneSuccess()
        throws Exception {
        Member student = saveStudent();
        Question first = saveQuestion();
        Question second = saveQuestion();
        Assignment assignment = saveAssignment(List.of(first.getId(), second.getId()));

        assertThat(submissionRepository.findByAssignmentIdAndStudentId(assignment.getId(), student.getId()))
            .isEmpty();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<AssignmentSubmissionResult> firstSuccess = new AtomicReference<>();
        AtomicReference<Exception> firstFailure = new AtomicReference<>();
        AtomicReference<AssignmentSubmissionResult> secondSuccess = new AtomicReference<>();
        AtomicReference<Exception> secondFailure = new AtomicReference<>();

        try {
            executor.submit(() -> {
                await(ready, start);
                try {
                    firstSuccess.set(studentAssignmentService.submit(assignment.getId(), student.getId()));
                } catch (Exception e) {
                    firstFailure.set(e);
                }
            });
            executor.submit(() -> {
                await(ready, start);
                try {
                    secondSuccess.set(studentAssignmentService.submit(assignment.getId(), student.getId()));
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

        long successCount = (firstSuccess.get() != null ? 1 : 0) + (secondSuccess.get() != null ? 1 : 0);
        long conflictCount = (firstFailure.get() instanceof AssignmentAlreadySubmittedException ? 1 : 0)
            + (secondFailure.get() instanceof AssignmentAlreadySubmittedException ? 1 : 0);
        assertThat(successCount).isEqualTo(1);
        assertThat(conflictCount).isEqualTo(1);

        List<AssignmentSubmission> submissions = submissionRepository.findAll().stream()
            .filter(submission -> submission.getAssignmentId().equals(assignment.getId()))
            .toList();
        assertThat(submissions).hasSize(1);
        assertThat(submissions.get(0).getStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
        assertThat(submissions.get(0).getSubmittedAt()).isNotNull();

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).hasSize(2);
        assertThat(records).allSatisfy(record -> {
            assertThat(record.getSubmittedAnswer()).isNull();
            assertThat(record.isCorrect()).isFalse();
        });
    }

    @Test
    void submit_rollsBackSubmissionAndStudyRecords_whenFailureOccursAfterFirstStudyRecordSave() {
        Member student = saveStudent();
        Question first = saveQuestion();
        Question second = saveQuestion();
        Assignment assignment = saveAssignment(List.of(first.getId(), second.getId()));
        studentAssignmentService.saveAnswerDraft(assignment.getId(), first.getId(), "since", student.getId());
        studentAssignmentService.saveAnswerDraft(assignment.getId(), second.getId(), "since", student.getId());

        FailAfterNStudyRecordStore failingStore = (FailAfterNStudyRecordStore) studyRecordStore;
        failingStore.failAfter(2);

        assertThatThrownBy(() -> studentAssignmentService.submit(assignment.getId(), student.getId()))
            .isInstanceOf(SimulatedStudyRecordFailure.class);

        entityManager.clear();

        List<StudyRecord> records = studyRecordRepository.findAll().stream()
            .filter(record -> assignment.getId().equals(record.getAssignmentId()))
            .toList();
        assertThat(records).isEmpty();

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
        assertThat(reloaded.getSubmittedAt()).isNull();
    }

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
