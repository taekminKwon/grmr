package com.ewha_eng.grmr.studentassignment.presentation;

import com.ewha_eng.grmr.studentassignment.application.AssignmentSubmissionResult;
import java.time.LocalDateTime;
import java.util.List;

public record AssignmentSubmitResponse(
    Long assignmentId,
    String submissionStatus,
    LocalDateTime submittedAt,
    int totalQuestions,
    int answeredQuestions,
    int correctCount,
    int score,
    List<AssignmentSubmitResultItemResponse> results
) {

    public static AssignmentSubmitResponse from(AssignmentSubmissionResult result) {
        return new AssignmentSubmitResponse(
            result.assignmentId(),
            "SUBMITTED",
            result.submittedAt(),
            result.totalQuestions(),
            result.answeredQuestions(),
            result.correctCount(),
            result.score(),
            result.results().stream().map(AssignmentSubmitResultItemResponse::from).toList()
        );
    }
}
