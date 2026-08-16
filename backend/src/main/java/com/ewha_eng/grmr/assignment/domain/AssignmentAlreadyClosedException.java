package com.ewha_eng.grmr.assignment.domain;

public class AssignmentAlreadyClosedException extends RuntimeException {

    public AssignmentAlreadyClosedException(String message) {
        super(message);
    }
}
