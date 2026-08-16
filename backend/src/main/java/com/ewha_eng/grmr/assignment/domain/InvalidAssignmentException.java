package com.ewha_eng.grmr.assignment.domain;

public class InvalidAssignmentException extends RuntimeException {

    public InvalidAssignmentException(String message) {
        super(message);
    }
}
