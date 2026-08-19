package com.ewha_eng.grmr.student.domain;

import java.time.LocalDate;

public record StudentAggregate(
    LocalDate lastStudiedAt,
    int totalQuestionCount,
    int correctCount,
    int pendingAssignmentCount
) {

    public static StudentAggregate empty() {
        return new StudentAggregate(null, 0, 0, 0);
    }

    public int accuracy() {
        if (totalQuestionCount == 0) {
            return 0;
        }
        return (int) Math.round(correctCount * 100.0 / totalQuestionCount);
    }
}
