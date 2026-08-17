package com.ewha_eng.grmr.studentassignment.application;

import java.time.LocalDateTime;
import java.util.List;

public record AssignmentSubmissionResult(
    Long assignmentId,
    LocalDateTime submittedAt,
    int totalQuestions,
    int answeredQuestions,
    int correctCount,
    int score,
    List<AssignmentSubmissionResultItem> results
) {
}
