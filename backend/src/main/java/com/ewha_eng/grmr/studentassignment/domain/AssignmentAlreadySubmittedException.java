package com.ewha_eng.grmr.studentassignment.domain;

public class AssignmentAlreadySubmittedException extends RuntimeException {

    public AssignmentAlreadySubmittedException(String message) {
        super(message);
    }
}
