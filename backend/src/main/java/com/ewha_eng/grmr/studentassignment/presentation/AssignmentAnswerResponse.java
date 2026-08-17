package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentAnswerDraftResult;
import java.time.LocalDateTime;

public record AssignmentAnswerResponse(
    Long questionId,
    String answer,
    LocalDateTime savedAt
) {

    public static AssignmentAnswerResponse from(AssignmentAnswerDraftResult result) {
        return new AssignmentAnswerResponse(result.questionId(), result.answer(), result.savedAt());
    }
}
