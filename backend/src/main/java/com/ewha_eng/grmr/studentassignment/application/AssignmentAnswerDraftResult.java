package com.ewha_eng.grmr.studentassignment.application;

import java.time.LocalDateTime;

public record AssignmentAnswerDraftResult(
    Long questionId,
    String answer,
    LocalDateTime savedAt
) {
}
