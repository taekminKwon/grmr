package com.ewha_eng.grmr.assignment.presentation;

import com.ewha_eng.grmr.assignment.application.AssignmentQuestionSummary;

public record AssignmentQuestionResponse(
    Long id,
    int order,
    String text,
    String category
) {

    public static AssignmentQuestionResponse from(AssignmentQuestionSummary summary) {
        return new AssignmentQuestionResponse(
            summary.questionId(),
            summary.order(),
            summary.text(),
            summary.category()
        );
    }
}
