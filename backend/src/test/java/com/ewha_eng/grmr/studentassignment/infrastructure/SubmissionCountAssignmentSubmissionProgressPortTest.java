package com.ewha_eng.grmr.studentassignment.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.ewha_eng.grmr.assignment.application.AssignmentSubmissionProgress;
import com.ewha_eng.grmr.assignment.domain.Assignment;
import com.ewha_eng.grmr.assignment.domain.AssignmentRepository;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.ewha_eng.grmr.member.domain.MemberReader;
import com.ewha_eng.grmr.member.domain.MemberType;
import com.ewha_eng.grmr.studentassignment.domain.AssignmentSubmissionRepository;
import com.ewha_eng.grmr.studentassignment.domain.SubmissionStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SubmissionCountAssignmentSubmissionProgressPortTest {

    @Mock
    private AssignmentRepository assignmentRepository;

    @Mock
    private MemberReader memberReader;

    @Mock
    private AssignmentSubmissionRepository assignmentSubmissionRepository;

    private SubmissionCountAssignmentSubmissionProgressPort port;

    private SubmissionCountAssignmentSubmissionProgressPort port() {
        return new SubmissionCountAssignmentSubmissionProgressPort(
            assignmentRepository, memberReader, assignmentSubmissionRepository);
    }

    @Test
    void progressFor_returnsZero_whenAssignmentIdIsNull() {
        port = port();

        AssignmentSubmissionProgress result = port.progressFor(null);

        assertThat(result).isEqualTo(AssignmentSubmissionProgress.zero());
    }

    @Test
    void progressFor_returnsZero_whenAssignmentDoesNotExist() {
        port = port();
        when(assignmentRepository.findById(999L)).thenReturn(Optional.empty());

        AssignmentSubmissionProgress result = port.progressFor(999L);

        assertThat(result).isEqualTo(AssignmentSubmissionProgress.zero());
    }

    @Test
    void progressFor_usesGroupMemberCount_asTarget_forClassAssignment() {
        port = port();
        Assignment classAssignment = classAssignment();
        ReflectionTestUtils.setField(classAssignment, "id", 10L);
        when(assignmentRepository.findById(10L)).thenReturn(Optional.of(classAssignment));
        when(memberReader.countByTypeAndStudentGroup(MemberType.STUDENT, "중1 A반")).thenReturn(4L);
        when(assignmentSubmissionRepository.countByAssignmentIdAndStatus(10L, SubmissionStatus.SUBMITTED))
            .thenReturn(1L);

        AssignmentSubmissionProgress result = port.progressFor(10L);

        assertThat(result).isEqualTo(new AssignmentSubmissionProgress(4, 1));
        assertThat(result.percentage()).isEqualTo(25);
    }

    @Test
    void progressFor_usesOne_asTarget_forStudentAssignment() {
        port = port();
        Assignment studentAssignment = studentAssignment();
        ReflectionTestUtils.setField(studentAssignment, "id", 11L);
        when(assignmentRepository.findById(11L)).thenReturn(Optional.of(studentAssignment));
        when(assignmentSubmissionRepository.countByAssignmentIdAndStatus(11L, SubmissionStatus.SUBMITTED))
            .thenReturn(0L);

        AssignmentSubmissionProgress result = port.progressFor(11L);

        assertThat(result).isEqualTo(new AssignmentSubmissionProgress(1, 0));
        assertThat(result.percentage()).isZero();
    }

    @Test
    void progressFor_returnsZeroPercentage_whenNoStudentsInTargetGroup() {
        port = port();
        Assignment classAssignment = classAssignment();
        ReflectionTestUtils.setField(classAssignment, "id", 12L);
        when(assignmentRepository.findById(12L)).thenReturn(Optional.of(classAssignment));
        when(memberReader.countByTypeAndStudentGroup(MemberType.STUDENT, "중1 A반")).thenReturn(0L);
        when(assignmentSubmissionRepository.countByAssignmentIdAndStatus(12L, SubmissionStatus.SUBMITTED))
            .thenReturn(0L);

        AssignmentSubmissionProgress result = port.progressFor(12L);

        assertThat(result.totalTargetCount()).isZero();
        assertThat(result.percentage()).isZero();
    }

    private Assignment classAssignment() {
        return Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 31))
            .questionIds(List.of(1L))
            .build();
    }

    private Assignment studentAssignment() {
        return Assignment.builder()
            .title("개별 보충 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(501L)
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 31))
            .questionIds(List.of(1L))
            .build();
    }
}
