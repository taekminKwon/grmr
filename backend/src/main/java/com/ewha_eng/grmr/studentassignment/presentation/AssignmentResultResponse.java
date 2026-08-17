package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentSubmissionResult;
import java.time.LocalDateTime;
import java.util.List;

public record AssignmentResultResponse(
    Long assignmentId,
    String submissionStatus,
    LocalDateTime submittedAt,
    int totalQuestions,
    int answeredQuestions,
    int correctCount,
    int score,
    List<AssignmentResultItemResponse> results
) {

    public static AssignmentResultResponse from(AssignmentSubmissionResult result) {
        return new AssignmentResultResponse(
            result.assignmentId(),
            "SUBMITTED",
            result.submittedAt(),
            result.totalQuestions(),
            result.answeredQuestions(),
            result.correctCount(),
            result.score(),
            result.results().stream().map(AssignmentResultItemResponse::from).toList()
        );
    }
}
