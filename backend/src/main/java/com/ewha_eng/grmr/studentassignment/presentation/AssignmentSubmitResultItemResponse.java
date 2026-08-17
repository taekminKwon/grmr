package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentSubmissionResultItem;

public record AssignmentSubmitResultItemResponse(
    Long questionId,
    String submittedAnswer,
    boolean correct,
    String correctAnswer,
    String explanation
) {

    public static AssignmentSubmitResultItemResponse from(AssignmentSubmissionResultItem item) {
        return new AssignmentSubmitResultItemResponse(
            item.questionId(), item.submittedAnswer(), item.correct(), item.correctAnswer(), item.explanation());
    }
}
