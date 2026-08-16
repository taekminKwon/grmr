package com.ewha_eng.grmr.assignment.application;

import com.ewha_eng.grmr.assignment.domain.AssignmentStatus;
import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import java.time.LocalDate;
import java.util.List;

public record AssignmentDetail(
    Long id,
    String title,
    AssignmentTargetType targetType,
    String targetGroup,
    Long targetStudentId,
    String targetDisplay,
    AssignmentStatus status,
    LocalDate startDate,
    LocalDate dueDate,
    List<AssignmentQuestionSummary> questions,
    AssignmentSubmissionProgress submissionProgress
) {
}
