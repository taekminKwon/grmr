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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class AssignmentSubmissionRepositoryImplTest {

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
    void findByAssignmentIdAndStudentId_returnsEmpty_whenNoSubmissionExists() {
        Optional<AssignmentSubmission> found = submissionRepository.findByAssignmentIdAndStudentId(999L, 999L);

        assertThat(found).isEmpty();
    }

    @Test
    void save_thenFindByAssignmentIdAndStudentId_returnsCreatedSubmission() {
        Member student = saveStudent("student01");
        Assignment assignment = saveAssignment();

        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        Optional<AssignmentSubmission> found = submissionRepository
            .findByAssignmentIdAndStudentId(assignment.getId(), student.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
    }

    @Test
    void save_rejectsSecondSubmission_forSameAssignmentAndStudent() {
        Member student = saveStudent("student02");
        Assignment assignment = saveAssignment();
        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        assertThatThrownBy(() -> submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now())))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void upsertDraft_thenSave_overwritesStoredAnswer_withoutCreatingSecondDraftRow() {
        Member student = saveStudent("student03");
        Assignment assignment = saveAssignment();
        Question question = saveQuestion();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        submission.upsertDraft(question.getId(), "since", LocalDateTime.now());
        submissionRepository.saveAndFlush(submission);
        entityManager.clear();

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        reloaded.upsertDraft(question.getId(), "for", LocalDateTime.now());
        submissionRepository.saveAndFlush(reloaded);
        entityManager.clear();

        AssignmentSubmission result = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();
        assertThat(result.answeredQuestionCount()).isEqualTo(1);
        assertThat(result.answerFor(question.getId())).contains("for");
    }

    @Test
    void findWithDraftsByAssignmentIdAndStudentId_loadsAllDistinctQuestionDrafts() {
        Member student = saveStudent("student04");
        Assignment assignment = saveAssignment();
        Question first = saveQuestion();
        Question second = saveQuestion();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));
        submission.upsertDraft(first.getId(), "since", LocalDateTime.now());
        submission.upsertDraft(second.getId(), "for", LocalDateTime.now());
        submissionRepository.saveAndFlush(submission);
        entityManager.clear();

        AssignmentSubmission reloaded = submissionRepository
            .findWithDraftsByAssignmentIdAndStudentId(assignment.getId(), student.getId())
            .orElseThrow();

        assertThat(reloaded.answeredQuestionCount()).isEqualTo(2);
        assertThat(reloaded.answerFor(first.getId())).contains("since");
        assertThat(reloaded.answerFor(second.getId())).contains("for");
    }

    @Test
    void countByAssignmentIdAndStatus_countsOnlySubmittedRows() {
        Assignment assignment = saveAssignment();
        Member first = saveStudent("student05");
        Member second = saveStudent("student06");
        Member third = saveStudent("student07");
        submitted(assignment, first);
        submitted(assignment, second);
        inProgress(assignment, third);

        long submittedCount = submissionRepository
            .countByAssignmentIdAndStatus(assignment.getId(), SubmissionStatus.SUBMITTED);
        long inProgressCount = submissionRepository
            .countByAssignmentIdAndStatus(assignment.getId(), SubmissionStatus.IN_PROGRESS);

        assertThat(submittedCount).isEqualTo(2);
        assertThat(inProgressCount).isEqualTo(1);
    }

    @Test
    void countByAssignmentIdAndStatus_returnsZero_whenNoSubmissionsExist() {
        long count = submissionRepository.countByAssignmentIdAndStatus(12345L, SubmissionStatus.SUBMITTED);

        assertThat(count).isZero();
    }

    @Test
    void findAllWithDraftsByStudentIdAndAssignmentIdIn_returnsOnlyMatchingStudentSubmissions() {
        Member student = saveStudent("student09");
        Member otherStudent = saveStudent("student10");
        Assignment first = saveAssignment();
        Assignment second = saveAssignment();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(first.getId(), student.getId(), LocalDateTime.now()));
        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(second.getId(), otherStudent.getId(), LocalDateTime.now()));
        entityManager.clear();

        List<AssignmentSubmission> results = submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(
            student.getId(), List.of(first.getId(), second.getId()));

        assertThat(results).extracting(AssignmentSubmission::getId).containsExactly(submission.getId());
    }

    @Test
    void findAllWithDraftsByStudentIdAndAssignmentIdIn_loadsDraftsForEachSubmission() {
        Member student = saveStudent("student11");
        Assignment assignment = saveAssignment();
        Question question = saveQuestion();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));
        submission.upsertDraft(question.getId(), "since", LocalDateTime.now());
        submissionRepository.saveAndFlush(submission);
        entityManager.clear();

        List<AssignmentSubmission> results = submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(
            student.getId(), List.of(assignment.getId()));

        assertThat(results).hasSize(1);
        assertThat(results.get(0).answerFor(question.getId())).contains("since");
    }

    @Test
    void findAllWithDraftsByStudentIdAndAssignmentIdIn_returnsEmpty_whenAssignmentIdsIsEmpty() {
        Member student = saveStudent("student12");

        List<AssignmentSubmission> results = submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(
            student.getId(), List.of());

        assertThat(results).isEmpty();
    }

    @Test
    void findByIdForSubmission_locksAndReturnsSubmission_readyForAtomicTransition() {
        Member student = saveStudent("student08");
        Assignment assignment = saveAssignment();
        AssignmentSubmission submission = submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));

        AssignmentSubmission locked = submissionRepository.findByIdForSubmission(submission.getId()).orElseThrow();
        locked.submit(LocalDateTime.now());
        submissionRepository.saveAndFlush(locked);

        AssignmentSubmission reloaded = submissionRepository.findById(submission.getId()).orElseThrow();
        assertThat(reloaded.isSubmitted()).isTrue();
    }

    private void submitted(Assignment assignment, Member student) {
        AssignmentSubmission submission = AssignmentSubmission.start(assignment.getId(), student.getId(),
            LocalDateTime.now());
        submission.submit(LocalDateTime.now());
        submissionRepository.saveAndFlush(submission);
    }

    private void inProgress(Assignment assignment, Member student) {
        submissionRepository.saveAndFlush(
            AssignmentSubmission.start(assignment.getId(), student.getId(), LocalDateTime.now()));
    }

    private Member saveStudent(String loginId) {
        return memberRepository.saveAndFlush(Member.builder()
            .loginId(loginId)
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
