package com.ewha_eng.grmr.assignment.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentAlreadyClosedException;
import com.ewha_eng.grmr.assignment.domain.AssignmentNotFoundException;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentException;
import com.ewha_eng.grmr.assignment.domain.InvalidAssignmentSearchException;
import com.ewha_eng.grmr.assignment.domain.StudentNotFoundException;
import com.ewha_eng.grmr.member.domain.Member;
import com.ewha_eng.grmr.member.domain.MemberNotFoundException;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.question.domain.Question;
import com.ewha_eng.grmr.question.domain.QuestionLevel;
import com.ewha_eng.grmr.question.domain.QuestionNotFoundException;
import com.ewha_eng.grmr.question.domain.QuestionRepository;
import com.ewha_eng.grmr.question.domain.QuestionType;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AssignmentAdminServiceTest {

    private static final LocalDate FIXED_TODAY = LocalDate.of(2026, 8, 16);

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private MemberReader memberReader;

    @Mock
    private AssignmentSubmissionProgressPort submissionProgressPort;

    private AssignmentAdminService service;

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(FIXED_TODAY.atStartOfDay(ZoneOffset.UTC).toInstant(), ZoneOffset.UTC);
        service = new AssignmentAdminService(assignmentRepository, questionRepository, memberReader,
            submissionProgressPort, fixedClock);
    }

    @Test
    void search_throws_whenPageIsNegative() {
        assertThatThrownBy(() -> service.search(null, null, -1, 20))
            .isInstanceOf(InvalidAssignmentSearchException.class);
    }

    @Test
    void search_throws_whenSizeIsBelowMinimum() {
        assertThatThrownBy(() -> service.search(null, null, 0, 0))
            .isInstanceOf(InvalidAssignmentSearchException.class);
    }

    @Test
    void search_throws_whenSizeExceedsMaximum() {
        assertThatThrownBy(() -> service.search(null, null, 0, 101))
            .isInstanceOf(InvalidAssignmentSearchException.class);
    }

    @Test
    void search_resolvesClassTargetDisplay_fromTargetGroup() {
        Assignment classAssignment = classAssignment();
        when(assignmentRepository.search(AssignmentStatus.IN_PROGRESS, "복습", FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(classAssignment)));
        when(submissionProgressPort.progressFor(isNull())).thenReturn(new AssignmentSubmissionProgress(4, 1));

        Page<AssignmentListItem> result = service.search(AssignmentStatus.IN_PROGRESS, "복습", 0, 20);

        assertThat(result.getContent()).hasSize(1);
        AssignmentListItem item = result.getContent().get(0);
        assertThat(item.targetType()).isEqualTo(AssignmentTargetType.CLASS);
        assertThat(item.targetDisplay()).isEqualTo("중1 A반");
        assertThat(item.status()).isEqualTo(AssignmentStatus.IN_PROGRESS);
        assertThat(item.questionCount()).isEqualTo(2);
        assertThat(item.submissionProgress()).isEqualTo(new AssignmentSubmissionProgress(4, 1));
    }

    @Test
    void search_resolvesStudentTargetDisplay_fromMemberName() {
        Assignment studentAssignment = studentAssignment();
        Member student = Member.builder()
            .loginId("student1")
            .password("hashed")
            .name("김민수")
            .type(MemberType.STUDENT)
            .build();
        when(assignmentRepository.search(null, null, FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(studentAssignment)));
        when(memberReader.findById(501L)).thenReturn(Optional.of(student));
        when(submissionProgressPort.progressFor(isNull())).thenReturn(AssignmentSubmissionProgress.zero());

        Page<AssignmentListItem> result = service.search(null, null, 0, 20);

        assertThat(result.getContent().get(0).targetDisplay()).isEqualTo("김민수");
    }

    @Test
    void search_throwsMemberNotFound_whenTargetStudentIsMissing() {
        Assignment studentAssignment = studentAssignment();
        when(assignmentRepository.search(null, null, FIXED_TODAY, PageRequest.of(0, 20)))
            .thenReturn(new PageImpl<>(List.of(studentAssignment)));
        when(memberReader.findById(501L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.search(null, null, 0, 20))
            .isInstanceOf(MemberNotFoundException.class);
    }

    @Test
    void getDetail_throwsAssignmentNotFound_whenIdIsMissing() {
        when(assignmentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDetail(999L))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void getDetail_returnsQuestionsInAssignmentOrder_withDefaultZeroProgress() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        Question first = question(101L, "관계대명사", "who 문제");
        Question second = question(102L, "현재완료", "since 문제");
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(questionRepository.findAllById(anyList())).thenReturn(List.of(second, first));
        when(submissionProgressPort.progressFor(10L)).thenReturn(AssignmentSubmissionProgress.zero());

        AssignmentDetail detail = service.getDetail(10L);

        assertThat(detail.questions()).extracting(AssignmentQuestionSummary::questionId)
            .containsExactly(102L, 101L);
        assertThat(detail.questions()).extracting(AssignmentQuestionSummary::order)
            .containsExactly(1, 2);
        assertThat(detail.submissionProgress()).isEqualTo(AssignmentSubmissionProgress.zero());
        assertThat(detail.status()).isEqualTo(AssignmentStatus.IN_PROGRESS);
    }

    @Test
    void create_savesClassAssignment_whenQuestionsExist() {
        when(questionRepository.findAllById(any())).thenReturn(List.of(question(101L, "관계대명사", "who 문제")));
        ArgumentCaptor<Assignment> captor = ArgumentCaptor.forClass(Assignment.class);
        when(assignmentRepository.save(captor.capture())).thenAnswer(invocation -> {
            Assignment saved = captor.getValue();
            ReflectionTestUtils.setField(saved, "id", 10L);
            return saved;
        });
        when(submissionProgressPort.progressFor(10L)).thenReturn(AssignmentSubmissionProgress.zero());

        AssignmentListItem created = service.create(
            "현재완료 시제 연습", AssignmentTargetType.CLASS, "중1 A반", null,
            FIXED_TODAY.plusDays(1), FIXED_TODAY.plusDays(3), List.of(101L));

        assertThat(created.id()).isEqualTo(10L);
        assertThat(created.targetType()).isEqualTo(AssignmentTargetType.CLASS);
        assertThat(created.targetDisplay()).isEqualTo("중1 A반");
        assertThat(created.status()).isEqualTo(AssignmentStatus.SCHEDULED);
    }

    @Test
    void create_savesStudentAssignment_preservingQuestionOrder() {
        Question first = question(101L, "관계대명사", "who 문제");
        Question second = question(102L, "현재완료", "since 문제");
        when(questionRepository.findAllById(any())).thenReturn(List.of(first, second));
        Member student = Member.builder().loginId("s1").password("h").name("김민수").type(MemberType.STUDENT).build();
        when(memberReader.findById(501L)).thenReturn(Optional.of(student));
        ArgumentCaptor<Assignment> captor = ArgumentCaptor.forClass(Assignment.class);
        when(assignmentRepository.save(captor.capture())).thenAnswer(invocation -> captor.getValue());
        when(submissionProgressPort.progressFor(isNull())).thenReturn(AssignmentSubmissionProgress.zero());

        AssignmentListItem created = service.create(
            "개별 보충 과제", AssignmentTargetType.STUDENT, null, 501L,
            FIXED_TODAY, FIXED_TODAY.plusDays(2), List.of(102L, 101L));

        assertThat(created.targetType()).isEqualTo(AssignmentTargetType.STUDENT);
        assertThat(created.targetDisplay()).isEqualTo("김민수");
        assertThat(captor.getValue().getQuestionIds()).containsExactly(102L, 101L);
    }

    @Test
    void create_throwsInvalidAssignment_whenStartDateAfterDueDate() {
        assertThatThrownBy(() -> service.create(
            "제목", AssignmentTargetType.CLASS, "중1 A반", null,
            FIXED_TODAY.plusDays(3), FIXED_TODAY.plusDays(1), List.of(101L)))
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void create_throwsQuestionNotFound_whenQuestionIdDoesNotExist() {
        when(questionRepository.findAllById(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.create(
            "제목", AssignmentTargetType.CLASS, "중1 A반", null,
            FIXED_TODAY, FIXED_TODAY.plusDays(1), List.of(999L)))
            .isInstanceOf(QuestionNotFoundException.class);

        verify(assignmentRepository, never()).save(any());
    }

    @Test
    void create_throwsStudentNotFound_whenTargetStudentDoesNotExist() {
        when(questionRepository.findAllById(any())).thenReturn(List.of(question(101L, "관계대명사", "who 문제")));
        when(memberReader.findById(501L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(
            "제목", AssignmentTargetType.STUDENT, null, 501L,
            FIXED_TODAY, FIXED_TODAY.plusDays(1), List.of(101L)))
            .isInstanceOf(StudentNotFoundException.class);

        verify(assignmentRepository, never()).save(any());
    }

    @Test
    void create_throwsStudentNotFound_whenTargetMemberIsNotStudentRole() {
        when(questionRepository.findAllById(any())).thenReturn(List.of(question(101L, "관계대명사", "who 문제")));
        Member admin = Member.builder().loginId("admin1").password("h").name("관리자").type(MemberType.ADMIN).build();
        when(memberReader.findById(501L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.create(
            "제목", AssignmentTargetType.STUDENT, null, 501L,
            FIXED_TODAY, FIXED_TODAY.plusDays(1), List.of(101L)))
            .isInstanceOf(StudentNotFoundException.class);

        verify(assignmentRepository, never()).save(any());
    }

    @Test
    void update_mergesOnlyProvidedFields_mergingDatesWithExistingValues() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(submissionProgressPort.progressFor(10L)).thenReturn(AssignmentSubmissionProgress.zero());
        when(questionRepository.findAllById(assignment.getQuestionIds()))
            .thenReturn(List.of(question(102L, "현재완료", "t1"), question(101L, "관계대명사", "t2")));

        AssignmentDetail updated = service.update(10L, null, null, null, null, FIXED_TODAY.plusDays(5), null);

        assertThat(updated.dueDate()).isEqualTo(FIXED_TODAY.plusDays(5));
        assertThat(updated.title()).isEqualTo("현재완료 복습 과제");
        assertThat(updated.targetGroup()).isEqualTo("중1 A반");
    }

    @Test
    void update_switchesTargetType_whenNewMatchingFieldProvided() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        Member student = Member.builder().loginId("s1").password("h").name("김민수").type(MemberType.STUDENT).build();
        when(memberReader.findById(501L)).thenReturn(Optional.of(student));
        when(submissionProgressPort.progressFor(10L)).thenReturn(AssignmentSubmissionProgress.zero());
        when(questionRepository.findAllById(assignment.getQuestionIds()))
            .thenReturn(List.of(question(102L, "현재완료", "t1"), question(101L, "관계대명사", "t2")));

        AssignmentDetail updated = service.update(
            10L, AssignmentTargetType.STUDENT, null, 501L, null, null, null);

        assertThat(updated.targetType()).isEqualTo(AssignmentTargetType.STUDENT);
        assertThat(updated.targetStudentId()).isEqualTo(501L);
        assertThat(updated.targetGroup()).isNull();
        assertThat(updated.targetDisplay()).isEqualTo("김민수");
    }

    @Test
    void update_replacesQuestionOrder_whenNewQuestionIdsProvided() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(submissionProgressPort.progressFor(10L)).thenReturn(AssignmentSubmissionProgress.zero());
        when(questionRepository.findAllById(any())).thenReturn(List.of(question(101L, "관계대명사", "t2")));

        AssignmentDetail updated = service.update(10L, null, null, null, null, null, List.of(101L));

        assertThat(updated.questions()).extracting(AssignmentQuestionSummary::questionId).containsExactly(101L);
    }

    @Test
    void update_throwsAssignmentNotFound_whenIdIsMissing() {
        when(assignmentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(999L, null, null, null, null, FIXED_TODAY, null))
            .isInstanceOf(AssignmentNotFoundException.class);
    }

    @Test
    void update_throwsInvalidAssignment_whenDatesConflictAfterMerge() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));

        assertThatThrownBy(() -> service.update(10L, null, null, null, FIXED_TODAY.plusDays(10), null, null))
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void update_throwsQuestionNotFound_whenNewQuestionIdDoesNotExist() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(questionRepository.findAllById(any())).thenReturn(List.of());

        assertThatThrownBy(() -> service.update(10L, null, null, null, null, null, List.of(999L)))
            .isInstanceOf(QuestionNotFoundException.class);
    }

    @Test
    void update_throwsStudentNotFound_whenNewTargetStudentDoesNotExist() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));
        when(memberReader.findById(501L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.update(
            10L, AssignmentTargetType.STUDENT, null, 501L, null, null, null))
            .isInstanceOf(StudentNotFoundException.class);
    }

    @Test
    void update_throwsAssignmentAlreadyClosed_whenAssignmentIsPastDueDate() {
        Assignment closedAssignment = Assignment.builder()
            .title("마감 과제")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(FIXED_TODAY.minusDays(10))
            .dueDate(FIXED_TODAY.minusDays(1))
            .questionIds(List.of(101L))
            .build();
        ReflectionTestUtils.setField(closedAssignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(closedAssignment));

        assertThatThrownBy(() -> service.update(10L, null, null, null, null, FIXED_TODAY.plusDays(1), null))
            .isInstanceOf(AssignmentAlreadyClosedException.class);

        verify(questionRepository, never()).findAllById(any());
    }

    @Test
    void delete_removesAssignment_whenIdExists() {
        Assignment assignment = classAssignment();
        ReflectionTestUtils.setField(assignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(assignment));

        service.delete(10L);

        verify(assignmentRepository).delete(assignment);
    }

    @Test
    void delete_throwsAssignmentNotFound_whenIdIsMissing() {
        when(assignmentRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.delete(999L))
            .isInstanceOf(AssignmentNotFoundException.class);

        verify(assignmentRepository, never()).delete(any());
    }

    private Assignment classAssignment() {
        return Assignment.builder()
            .title("현재완료 복습 과제")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(FIXED_TODAY.minusDays(1))
            .dueDate(FIXED_TODAY.plusDays(1))
            .questionIds(List.of(102L, 101L))
            .build();
    }

    private Assignment studentAssignment() {
        return Assignment.builder()
            .title("개별 보충 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(501L)
            .startDate(FIXED_TODAY.minusDays(1))
            .dueDate(FIXED_TODAY.plusDays(1))
            .questionIds(List.of(101L))
            .build();
    }

    private Question question(Long id, String category, String text) {
        Question question = Question.builder()
            .category(category)
            .type(QuestionType.MULTIPLE_CHOICE)
            .level(QuestionLevel.BASIC)
            .text(text)
            .choices(List.of("a", "b"))
            .answer("a")
            .explanation("해설")
            .build();
        ReflectionTestUtils.setField(question, "id", id);
        return question;
    }
}
