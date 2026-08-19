package com.ewha_eng.grmr.student.application;

import java.time.LocalDate;

public record StudentSummary(
    Long id,
    String name,
    String studentGroup,
    LocalDate lastStudiedAt,
    int totalQuestionCount,
    int accuracy,
    int pendingAssignmentCount
) {
}
