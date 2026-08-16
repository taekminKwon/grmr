package com.ewha_eng.grmr.assignment.presentation;

import com.ewha_eng.grmr.assignment.application.AssignmentListItem;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDate;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AssignmentListItemResponse(
    Long id,
    String title,
    AssignmentTargetType targetType,
    String targetGroup,
    Long targetStudentId,
    String target,
    LocalDate startDate,
    LocalDate dueDate,
    int progress,
    String status
) {

    public static AssignmentListItemResponse from(AssignmentListItem item) {
        return new AssignmentListItemResponse(
            item.id(),
            item.title(),
            item.targetType(),
            item.targetGroup(),
            item.targetStudentId(),
            item.targetDisplay(),
            item.startDate(),
            item.dueDate(),
            item.submissionProgress().percentage(),
            label(item.status())
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
