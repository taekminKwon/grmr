package com.ewha_eng.grmr.studentassignment.domain;

public class AssignmentNotSubmittedException extends RuntimeException {

    public AssignmentNotSubmittedException(String message) {
        super(message);
    }
}
