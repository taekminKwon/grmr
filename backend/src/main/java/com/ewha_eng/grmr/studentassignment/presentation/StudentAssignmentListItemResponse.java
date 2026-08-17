package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.studentassignment.application.StudentAssignmentListItem;
import java.time.LocalDate;

public record StudentAssignmentListItemResponse(
    Long id,
    String title,
    LocalDate startDate,
    LocalDate dueDate,
    String status,
    String submissionStatus,
    int progress
) {

    public static StudentAssignmentListItemResponse from(StudentAssignmentListItem item) {
        return new StudentAssignmentListItemResponse(
            item.id(),
            item.title(),
            item.startDate(),
            item.dueDate(),
            label(item.status()),
            item.submissionStatus().name(),
            item.progress()
        );
    }

    private static String label(AssignmentStatus status) {
        return switch (status) {
            case SCHEDULED -> "예정";
            case IN_PROGRESS -> "진행 중";
            case CLOSED -> "마감";
        };
    }
}
