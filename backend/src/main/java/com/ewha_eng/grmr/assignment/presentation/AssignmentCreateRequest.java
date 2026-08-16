package com.ewha_eng.grmr.assignment.presentation;

import com.ewha_eng.grmr.assignment.domain.AssignmentTargetType;
import java.time.LocalDate;
import java.util.List;

public record AssignmentCreateRequest(
    String title,
    AssignmentTargetType targetType,
    String targetGroup,
    Long targetStudentId,
    LocalDate startDate,
    LocalDate dueDate,
    List<Long> questionIds
) {
}
