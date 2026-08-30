package com.ewha_eng.grmr.student.presentation;

import com.ewha_eng.grmr.student.application.StudentSummary;
import java.time.LocalDate;

public record StudentResponse(
    Long id,
    String name,
    String studentGroup,
    LocalDate lastStudiedAt,
    int totalQuestionCount,
    int accuracy,
    int pendingAssignmentCount
) {

    public static StudentResponse from(StudentSummary summary) {
        return new StudentResponse(
            summary.id(),
            summary.name(),
            summary.studentGroup(),
            summary.lastStudiedAt(),
            summary.totalQuestionCount(),
            summary.accuracy(),
            summary.pendingAssignmentCount()
        );
    }
}
