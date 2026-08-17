package com.ewha_eng.grmr.studentassignment.domain;

/**
 * Signals that the stored ASSIGNMENT {@code StudyRecord} snapshots for a submission don't line up
 * with the assignment's current question list (e.g. a question was added/removed after the
 * student submitted). This should never happen in normal operation, so it is intentionally left
 * unmapped in {@code GlobalExceptionHandler} and surfaces as a generic 500 rather than a
 * documented API error, instead of silently returning a misleading result.
 */
public class AssignmentResultInconsistentException extends IllegalStateException {

    public AssignmentResultInconsistentException(String message) {
        super(message);
    }
}
