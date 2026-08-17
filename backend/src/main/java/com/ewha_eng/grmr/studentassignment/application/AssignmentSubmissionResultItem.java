package com.ewha_eng.grmr.studentassignment.application;

public record AssignmentSubmissionResultItem(
    Long questionId,
    String submittedAnswer,
    boolean correct,
    String correctAnswer,
    String explanation
) {
}
