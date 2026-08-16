package com.ewha_eng.grmr.studentassignment.domain;

public class InvalidAssignmentSubmissionException extends RuntimeException {

    public InvalidAssignmentSubmissionException(String message) {
        super(message);
    }
}
