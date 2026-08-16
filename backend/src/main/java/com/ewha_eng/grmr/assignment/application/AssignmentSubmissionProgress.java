package com.ewha_eng.grmr.assignment.application;

public record AssignmentSubmissionProgress(int totalTargetCount, int submittedCount) {

    public static AssignmentSubmissionProgress zero() {
        return new AssignmentSubmissionProgress(0, 0);
    }

    public int percentage() {
        if (totalTargetCount == 0) {
            return 0;
        }
        return (int) Math.round(submittedCount * 100.0 / totalTargetCount);
    }
}
