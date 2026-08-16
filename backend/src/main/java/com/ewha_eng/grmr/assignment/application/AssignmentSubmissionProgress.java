package com.ewha_eng.grmr.assignment.application;

public record AssignmentSubmissionProgress(int totalTargetCount, int submittedCount) {

    public static AssignmentSubmissionProgress zero() {
        return new AssignmentSubmissionProgress(0, 0);
    }
}
