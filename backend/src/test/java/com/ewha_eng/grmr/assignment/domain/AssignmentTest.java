package com.ewha_eng.grmr.assignment.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class AssignmentTest {

    @Test
    void builder_createsAssignment_withClassTarget() {
        Assignment assignment = classAssignment();

        assertThat(assignment.getTargetType()).isEqualTo(AssignmentTargetType.CLASS);
        assertThat(assignment.getTargetGroup()).isEqualTo("중1 A반");
        assertThat(assignment.getTargetStudentId()).isNull();
        assertThat(assignment.getQuestionIds()).containsExactly(1024L, 1023L, 1021L);
    }

    @Test
    void builder_createsAssignment_withStudentTarget() {
        Assignment assignment = Assignment.builder()
            .title("복습 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .targetStudentId(501L)
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(1024L))
            .build();

        assertThat(assignment.getTargetType()).isEqualTo(AssignmentTargetType.STUDENT);
        assertThat(assignment.getTargetStudentId()).isEqualTo(501L);
        assertThat(assignment.getTargetGroup()).isNull();
    }

    @Test
    void builder_throws_whenTitleIsBlank() {
        assertThatThrownBy(() -> classAssignmentBuilder().title("   ").build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenTitleExceedsMaxLength() {
        assertThatThrownBy(() -> classAssignmentBuilder().title("가".repeat(201)).build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenTargetTypeIsNull() {
        assertThatThrownBy(() -> classAssignmentBuilder().targetType(null).build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenClassTargetMissingGroup() {
        assertThatThrownBy(() -> Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(1024L))
            .build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenStudentTargetMissingStudentId() {
        assertThatThrownBy(() -> Assignment.builder()
            .title("복습 과제")
            .targetType(AssignmentTargetType.STUDENT)
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(1024L))
            .build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenStartDateIsAfterDueDate() {
        assertThatThrownBy(() -> classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 10))
            .dueDate(LocalDate.of(2026, 8, 8))
            .build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_allowsStartDateEqualToDueDate() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 8))
            .build();

        assertThat(assignment.getStartDate()).isEqualTo(assignment.getDueDate());
    }

    @Test
    void builder_throws_whenQuestionIdsIsEmpty() {
        assertThatThrownBy(() -> classAssignmentBuilder().questionIds(List.of()).build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_throws_whenQuestionIdsHasDuplicates() {
        assertThatThrownBy(() -> classAssignmentBuilder().questionIds(List.of(1024L, 1024L)).build())
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void builder_preservesQuestionOrder() {
        Assignment assignment = classAssignmentBuilder().questionIds(List.of(1021L, 1024L, 1023L)).build();

        assertThat(assignment.getQuestionIds()).containsExactly(1021L, 1024L, 1023L);
    }

    @Test
    void status_returnsScheduled_whenTodayIsBeforeStartDate() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThat(assignment.status(LocalDate.of(2026, 8, 7))).isEqualTo(AssignmentStatus.SCHEDULED);
    }

    @Test
    void status_returnsInProgress_onStartDateBoundary() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThat(assignment.status(LocalDate.of(2026, 8, 8))).isEqualTo(AssignmentStatus.IN_PROGRESS);
    }

    @Test
    void status_returnsInProgress_onDueDateBoundary() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThat(assignment.status(LocalDate.of(2026, 8, 10))).isEqualTo(AssignmentStatus.IN_PROGRESS);
    }

    @Test
    void status_returnsClosed_whenTodayIsAfterDueDate() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThat(assignment.status(LocalDate.of(2026, 8, 11))).isEqualTo(AssignmentStatus.CLOSED);
    }

    @Test
    void update_changesOnlyProvidedFields() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assignment.update(null, null, null, null, null, LocalDate.of(2026, 8, 12), null,
            LocalDate.of(2026, 8, 9));

        assertThat(assignment.getDueDate()).isEqualTo(LocalDate.of(2026, 8, 12));
        assertThat(assignment.getTitle()).isEqualTo("현재완료 시제 연습");
        assertThat(assignment.getTargetGroup()).isEqualTo("중1 A반");
    }

    @Test
    void update_throws_whenAssignmentIsClosed() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 1))
            .dueDate(LocalDate.of(2026, 8, 3))
            .build();

        assertThatThrownBy(() -> assignment.update(null, null, null, null, null, null, null,
            LocalDate.of(2026, 8, 10)))
            .isInstanceOf(AssignmentAlreadyClosedException.class);
    }

    @Test
    void update_throws_whenTargetTypeChangesWithoutNewTargetField() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThatThrownBy(() -> assignment.update(null, AssignmentTargetType.STUDENT, null, null, null, null,
            null, LocalDate.of(2026, 8, 9)))
            .isInstanceOf(InvalidAssignmentException.class);
    }

    @Test
    void update_switchesTargetType_whenNewTargetFieldProvided() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assignment.update(null, AssignmentTargetType.STUDENT, null, 501L, null, null, null,
            LocalDate.of(2026, 8, 9));

        assertThat(assignment.getTargetType()).isEqualTo(AssignmentTargetType.STUDENT);
        assertThat(assignment.getTargetStudentId()).isEqualTo(501L);
        assertThat(assignment.getTargetGroup()).isNull();
    }

    @Test
    void update_replacesQuestionOrder_whenNewQuestionIdsProvided() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assignment.update(null, null, null, null, null, null, List.of(1021L, 1023L),
            LocalDate.of(2026, 8, 9));

        assertThat(assignment.getQuestionIds()).containsExactly(1021L, 1023L);
    }

    @Test
    void update_throws_whenResultingQuestionIdsIsEmpty() {
        Assignment assignment = classAssignmentBuilder()
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .build();

        assertThatThrownBy(() -> assignment.update(null, null, null, null, null, null, List.of(),
            LocalDate.of(2026, 8, 9)))
            .isInstanceOf(InvalidAssignmentException.class);
    }

    private Assignment classAssignment() {
        return classAssignmentBuilder().build();
    }

    private Assignment.AssignmentBuilder classAssignmentBuilder() {
        return Assignment.builder()
            .title("현재완료 시제 연습")
            .targetType(AssignmentTargetType.CLASS)
            .targetGroup("중1 A반")
            .startDate(LocalDate.of(2026, 8, 8))
            .dueDate(LocalDate.of(2026, 8, 10))
            .questionIds(List.of(1024L, 1023L, 1021L));
    }
}
