package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentSubmissionResultItem;

public record AssignmentResultItemResponse(
    Long questionId,
    String submittedAnswer,
    boolean correct,
    String correctAnswer,
    String explanation
) {

    public static AssignmentResultItemResponse from(AssignmentSubmissionResultItem item) {
        return new AssignmentResultItemResponse(
            item.questionId(), item.submittedAnswer(), item.correct(), item.correctAnswer(), item.explanation());
    }
}
