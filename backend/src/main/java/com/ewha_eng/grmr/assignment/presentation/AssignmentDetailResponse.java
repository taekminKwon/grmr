package com.ewha_eng.grmr.assignment.presentation;

import com.ewha_eng.grmr.assignment.application.AssignmentDetail;
import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.LocalDate;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AssignmentDetailResponse(
    Long id,
    String title,
    AssignmentTargetType targetType,
    String targetGroup,
    Long targetStudentId,
    String target,
    LocalDate startDate,
    LocalDate dueDate,
    String status,
    int progress,
    List<AssignmentQuestionResponse> questions
) {

    public static AssignmentDetailResponse from(AssignmentDetail detail) {
        return new AssignmentDetailResponse(
            detail.id(),
            detail.title(),
            detail.targetType(),
            detail.targetGroup(),
            detail.targetStudentId(),
            detail.targetDisplay(),
            detail.startDate(),
            detail.dueDate(),
            label(detail.status()),
            detail.submissionProgress().percentage(),
            detail.questions().stream().map(AssignmentQuestionResponse::from).toList()
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
