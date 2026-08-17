package com.ewha_eng.grmr.studentassignment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmission;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.StudentAssignmentProgressStatus;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class StudentAssignmentServiceTest {

    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 8, 16);
    private static final Long STUDENT_ID = 501L;

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private AssignmentSubmissionRepository submissionRepository;

    @Mock
    private AssignmentSubmissionStarter submissionStarter;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private MemberReader memberReader;

    private StudentAssignmentService service;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(FIXED_TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        service = new StudentAssignmentService(assignmentRepository, submissionRepository, submissionStarter,
            questionRepository, memberReader, fixedClock);
    }

    @Test
    void getMyAssignments_throws_whenPageIsNegative() {
        assertThatThrownBy(() -> service.getMyAssignments(STUDENT_ID, -1, 20))
            .isInstanceOf(InvalidAssignmentSearchException.class);
    }

    @Test
    void getMyAssignments_throws_whenSizeExceedsMaximum() {
        assertThatThrownBy(() -> service.getMyAssignments(STUDENT_ID, 0, 101))
            .isInstanceOf(InvalidAssignmentSearchException.class);
    }

    @Test
    void getMyAssignments_throws_whenStudentDoesNotExist() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getMyAssignments(STUDENT_ID, 0, 20))
            .isInstanceOf(MemberNotFoundException.class);
    }

    @Test
    void getMyAssignments_marksNotStarted_withZeroProgress_whenNoSubmissionExists() {
        Member student = student("중1 A반");
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        Assignment assignment = classAssignment(2, FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findForStudent(STUDENT_ID, "중1 A반", FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(assignment), PageRequest.of(0, 20), 1));
        when(submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(STUDENT_ID, List.of(10L)))
            .thenReturn(List.of());

        Page<StudentAssignmentListItem> result = service.getMyAssignments(STUDENT_ID, 0, 20);

        StudentAssignmentListItem item = result.getContent().get(0);
        assertThat(item.id()).isEqualTo(10L);
        assertThat(item.startDate()).isEqualTo(FIXED_TODAY);
        assertThat(item.status()).isEqualTo(AssignmentStatus.IN_PROGRESS);
        assertThat(item.submissionStatus()).isEqualTo(StudentAssignmentProgressStatus.NOT_STARTED);
        assertThat(item.progress()).isZero();
    }

    @Test
    void getMyAssignments_marksInProgress_withDraftCount_whenSubmissionNotSubmittedYet() {
        Member student = student("중1 A반");
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        Assignment assignment = classAssignment(2, FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findForStudent(STUDENT_ID, "중1 A반", FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(assignment), PageRequest.of(0, 20), 1));
        AssignmentSubmission submission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        submission.upsertDraft(1024L, "since", LocalDateTime.now());
        when(submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(STUDENT_ID, List.of(10L)))
            .thenReturn(List.of(submission));

        Page<StudentAssignmentListItem> result = service.getMyAssignments(STUDENT_ID, 0, 20);

        StudentAssignmentListItem item = result.getContent().get(0);
        assertThat(item.submissionStatus()).isEqualTo(StudentAssignmentProgressStatus.IN_PROGRESS);
        assertThat(item.progress()).isEqualTo(50);
    }

    @Test
    void getMyAssignments_marksSubmitted_whenSubmissionIsSubmitted() {
        Member student = student("중1 A반");
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student));
        Assignment assignment = classAssignment(1, FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findForStudent(STUDENT_ID, "중1 A반", FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(assignment), PageRequest.of(0, 20), 1));
        AssignmentSubmission submission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        submission.submit(LocalDateTime.now());
        when(submissionRepository.findAllWithDraftsByStudentIdAndAssignmentIdIn(STUDENT_ID, List.of(10L)))
            .thenReturn(List.of(submission));

        Page<StudentAssignmentListItem> result = service.getMyAssignments(STUDENT_ID, 0, 20);

        assertThat(result.getContent().get(0).submissionStatus())
            .isEqualTo(StudentAssignmentProgressStatus.SUBMITTED);
    }

    @Test
    void getQuestions_throws_whenAssignmentDoesNotExist() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        when(assignmentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getQuestions(999L, STUDENT_ID))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void getQuestions_throws_whenClassAssignmentDoesNotMatchStudentGroup() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중2 B반")));
        Assignment assignment = classAssignment(1, FIXED_TODAY, FIXED_TODAY.plusDays(1));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));

        assertThatThrownBy(() -> service.getQuestions(10L, STUDENT_ID))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void getQuestions_throws_whenIndividualAssignmentTargetsAnotherStudent() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Assignment assignment = individualAssignment(999L, FIXED_TODAY, FIXED_TODAY.plusDays(1));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));

        assertThatThrownBy(() -> service.getQuestions(10L, STUDENT_ID))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void getQuestions_throws_whenAssignmentIsScheduled() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Assignment assignment = classAssignment(1, FIXED_TODAY.plusDays(1), FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));

        assertThatThrownBy(() -> service.getQuestions(10L, STUDENT_ID))
            .isInstanceOf(AssignmentNotFoundException.class);
        verify(submissionRepository, never()).findWithDraftsByAssignmentIdAndStudentId(anyLong(), anyLong());
    }

    @Test
    void getQuestions_allowsClosedAssignment_toBeReviewed() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Question question = question(1024L, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.");
        Assignment assignment = assignmentWithQuestions(List.of(1024L), FIXED_TODAY.minusDays(10),
            FIXED_TODAY.minusDays(1));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        AssignmentSubmission submission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        submission.upsertDraft(1024L, "since", LocalDateTime.now());
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.of(submission));
        when(questionRepository.findAllById(List.of(1024L))).thenReturn(List.of(question));

        StudentAssignmentQuestions result = service.getQuestions(10L, STUDENT_ID);

        assertThat(result.assignmentId()).isEqualTo(10L);
        assertThat(result.submissionStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
        assertThat(result.questions().get(0).myAnswer()).isEqualTo("since");
        verify(submissionStarter, never()).startNew(10L, STUDENT_ID);
    }

    @Test
    void getQuestions_returnsSubmittedStatus_whenReviewingASubmittedAssignment() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Question question = question(1024L, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.");
        Assignment assignment = assignmentWithQuestions(List.of(1024L), FIXED_TODAY.minusDays(10),
            FIXED_TODAY.minusDays(1));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        AssignmentSubmission submission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        submission.upsertDraft(1024L, "since", LocalDateTime.now());
        submission.submit(LocalDateTime.now());
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.of(submission));
        when(questionRepository.findAllById(List.of(1024L))).thenReturn(List.of(question));

        StudentAssignmentQuestions result = service.getQuestions(10L, STUDENT_ID);

        assertThat(result.assignmentId()).isEqualTo(10L);
        assertThat(result.submissionStatus()).isEqualTo(SubmissionStatus.SUBMITTED);
    }

    @Test
    void getQuestions_createsSubmission_onFirstRead() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Question question = question(1024L, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.");
        Assignment assignment = assignmentWithQuestions(List.of(1024L), FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.empty());
        AssignmentSubmission created = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        when(submissionStarter.startNew(10L, STUDENT_ID)).thenReturn(created);
        when(questionRepository.findAllById(List.of(1024L))).thenReturn(List.of(question));

        StudentAssignmentQuestions result = service.getQuestions(10L, STUDENT_ID);

        assertThat(result.assignmentId()).isEqualTo(10L);
        assertThat(result.submissionStatus()).isEqualTo(SubmissionStatus.IN_PROGRESS);
        assertThat(result.questions()).hasSize(1);
        assertThat(result.questions().get(0).myAnswer()).isNull();
        verify(submissionStarter, times(1)).startNew(10L, STUDENT_ID);
    }

    @Test
    void getQuestions_reFetchesSubmission_whenConcurrentRequestWonTheRace() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Question question = question(1024L, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.");
        Assignment assignment = assignmentWithQuestions(List.of(1024L), FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        AssignmentSubmission winnerSubmission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        winnerSubmission.upsertDraft(1024L, "since", LocalDateTime.now());
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.empty())
            .thenReturn(Optional.of(winnerSubmission));
        when(submissionStarter.startNew(10L, STUDENT_ID))
            .thenThrow(new DataIntegrityViolationException("unique constraint violation"));
        when(questionRepository.findAllById(List.of(1024L))).thenReturn(List.of(question));

        StudentAssignmentQuestions result = service.getQuestions(10L, STUDENT_ID);

        assertThat(result.questions().get(0).myAnswer()).isEqualTo("since");
        verify(submissionRepository, times(2))
            .findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID);
    }

    @Test
    void getQuestions_rethrowsOriginalException_whenRaceLossIsNotExplainedByAWinner() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Assignment assignment = assignmentWithQuestions(List.of(1024L), FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.empty());
        DataIntegrityViolationException raceException = new DataIntegrityViolationException("unexpected failure");
        when(submissionStarter.startNew(10L, STUDENT_ID)).thenThrow(raceException);

        assertThatThrownBy(() -> service.getQuestions(10L, STUDENT_ID)).isSameAs(raceException);
    }

    @Test
    void getQuestions_exposesOnlyStudentFacingFields_inOrder() {
        when(memberReader.findById(STUDENT_ID)).thenReturn(Optional.of(student("중1 A반")));
        Question first = question(1024L, "현재완료", QuestionLevel.INTERMEDIATE, "He has lived here _____ 2010.");
        Question second = question(1023L, "가정법", QuestionLevel.ADVANCED, "If I _____ you.");
        Assignment assignment = assignmentWithQuestions(List.of(1024L, 1023L), FIXED_TODAY, FIXED_TODAY.plusDays(3));
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        AssignmentSubmission submission = AssignmentSubmission.start(10L, STUDENT_ID, LocalDateTime.now());
        submission.upsertDraft(1023L, "were", LocalDateTime.now());
        when(submissionRepository.findWithDraftsByAssignmentIdAndStudentId(10L, STUDENT_ID))
            .thenReturn(Optional.of(submission));
        when(questionRepository.findAllById(List.of(1024L, 1023L))).thenReturn(List.of(first, second));

        List<StudentAssignmentQuestion> result = service.getQuestions(10L, STUDENT_ID).questions();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).id()).isEqualTo(1024L);
        assertThat(result.get(0).order()).isEqualTo(1);
        assertThat(result.get(0).category()).isEqualTo("현재완료");
        assertThat(result.get(0).level()).isEqualTo(QuestionLevel.INTERMEDIATE);
        assertThat(result.get(0).myAnswer()).isNull();
        assertThat(result.get(1).id()).isEqualTo(1023L);
        assertThat(result.get(1).order()).isEqualTo(2);
        assertThat(result.get(1).myAnswer()).isEqualTo("were");
    }

    private Member student(String studentGroup) {
        return Member.builder()
            .loginId("student-" + STUDENT_ID)
            .password("hashed-password")
            .name("김민수")
            .type(MemberType.STUDENT)
            .studentGroup(studentGroup)
            .build();
    }

    private Assignment classAssignment(int questionCount, LocalDate startDate, LocalDate dueDate) {
        List<Long> questionIds = List.of(1024L, 1023L, 1022L, 1021L).subList(0, questionCount);
        return Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(questionIds)
            .build();
    }

    private Assignment individualAssignment(Long targetStudentId, LocalDate startDate, LocalDate dueDate) {
        return Assignment.builder()
            .title("개별 보충 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(targetStudentId)
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(List.of(1024L))
            .build();
    }

    private Assignment assignmentWithQuestions(List<Long> questionIds, LocalDate startDate, LocalDate dueDate) {
        return Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(startDate)
            .dueDate(dueDate)
            .questionIds(questionIds)
            .build();
    }

    private Question question(Long id, String category, QuestionLevel level, String text) {
        Question question = Question.builder()
            .category(category)
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(level)
            .text(text)
            .choices(List.of("since", "for", "during", "from"))
            .answer("since")
            .explanation("해설")
            .build();
        ReflectionTestUtils.setField(question, "id", id);
        return question;
    }
}
